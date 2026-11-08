package com.pms;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.pms.execution.*;
import com.pms.execution.ExecutionService.*;
import com.pms.projects.*;
import com.pms.users.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ExecutionTests {
  @Autowired ExecutionService execution;
  @Autowired ProjectService projects;
  @Autowired UserRepository users;
  @Autowired JdbcTemplate db;
  @Autowired MockMvc mvc;
  @Autowired DelayMonitor delays;
  @Autowired ProjectReports reports;
  @Autowired Clock clock;
  AppUser manager, reviewer, engineer, outsider;
  Long project;
  final BigDecimal hundred = new BigDecimal("100");

  AppUser account(String role) {
    var u = new AppUser();
    u.email = UUID.randomUUID() + "@execution.test";
    u.employeeCode = UUID.randomUUID().toString();
    u.fullName = role;
    u.passwordHash = "unused-test-hash";
    u.roles.add(role);
    return users.saveAndFlush(u);
  }

  void as(AppUser u) {
    SecurityContextHolder.getContext()
        .setAuthentication(
            new UsernamePasswordAuthenticationToken(
                u.email,
                "",
                u.roles.stream().map(r -> new SimpleGrantedAuthority("ROLE_" + r)).toList()));
  }

  @BeforeEach
  void setup() {
    manager = account("ADMIN");
    reviewer = account("SUPER_ADMIN");
    engineer = account("ENGINEER");
    outsider = account("ENGINEER");
    as(manager);
    project =
        projects
            .create(
                new ProjectDtos.ProjectInput(
                    "Execution test",
                    "Description",
                    "Construction",
                    "Nairobi",
                    "Client",
                    manager.id,
                    LocalDate.now(clock).minusDays(5),
                    LocalDate.now(clock).plusDays(10),
                    Project.Priority.HIGH,
                    Project.Status.IN_PROGRESS,
                    new BigDecimal("2000"),
                    null,
                    null))
            .id();
  }

  Long task(String weight) {
    execution.task(
        project,
        new Task("Task", engineer.id, LocalDate.now(clock).plusDays(1), new BigDecimal(weight)));
    Long task =
        db.queryForObject(
            "select max(id) from project_tasks where project_id=?", Long.class, project);
    as(engineer);
    Long plan = request("WORK_PLAN", task, null);
    approve(plan);
    as(manager);
    return task;
  }

  Long request(String kind, Long task, String amount) {
    return execution.submit(
        project,
        new Request(
            kind, task, amount == null ? null : new BigDecimal(amount), null, "Test explanation"));
  }

  void evidence(Long request) {
    execution.upload(
        project, request, "proof.png", new byte[] {(byte) 137, 80, 78, 71, 13, 10, 26, 10, 0});
  }

  void approve(Long request) {
    as(reviewer);
    execution.review(project, request, new Decision(true, "Verified"));
  }

  @Test
  void assignmentsGrantAndRevokeScopedAccess() throws Exception {
    mvc.perform(
            get("/api/projects/" + project + "/execution")
                .with(user(outsider.email).roles("ENGINEER")))
        .andExpect(status().isNotFound());
    as(manager);
    execution.assign(project, new Assignment(engineer.id));
    mvc.perform(get("/api/projects/" + project).with(user(engineer.email).roles("ENGINEER")))
        .andExpect(status().isOk());
    mvc.perform(get("/api/projects").with(user(engineer.email).roles("ENGINEER")))
        .andExpect(jsonPath("$.total").value(1));
    Long assignment =
        db.queryForObject(
            "select id from project_assignments where project_id=?", Long.class, project);
    as(manager);
    execution.revoke(project, assignment);
    mvc.perform(get("/api/projects/" + project).with(user(engineer.email).roles("ENGINEER")))
        .andExpect(status().isNotFound());
    assertNotNull(
        db.queryForObject(
            "select revoked_at from project_assignments where id=?", Object.class, assignment));
  }

  @Test
  void progressRequiresEvidenceDifferentReviewerAndUpdatesWeightedTotal() {
    execution.assign(project, new Assignment(engineer.id));
    Long first = task("1");
    task("3");
    as(engineer);
    Long req = request("PROGRESS", first, "100");
    as(reviewer);
    assertThrows(
        ResponseStatusException.class,
        () -> execution.review(project, req, new Decision(true, "No proof")));
    as(engineer);
    evidence(req);
    as(manager);
    execution.review(project, req, new Decision(true, "Proof checked"));
    assertEquals(
        0,
        new BigDecimal("25")
            .compareTo(
                db.queryForObject(
                    "select progress from projects where id=?", BigDecimal.class, project)));
    assertThrows(
        ResponseStatusException.class,
        () -> execution.review(project, req, new Decision(true, "Duplicate")));
    as(manager);
    Long budget = request("BUDGET", null, "1000");
    assertEquals(
        403,
        assertThrows(
                ResponseStatusException.class,
                () -> execution.review(project, budget, new Decision(true, "Self")))
            .getStatusCode()
            .value());
  }

  @Test
  void costsAreExactAndCannotExceedApprovedBudget() throws Exception {
    Long budget = request("BUDGET", null, "9007199254740993.01");
    approve(budget);
    as(manager);
    Long expense = request("EXPENSE", null, "9007199254740993.01");
    approve(expense);
    assertEquals(
        new BigDecimal("9007199254740993.01"),
        db.queryForObject(
            "select actual_expenditure from projects where id=?", BigDecimal.class, project));
    as(manager);
    Long excess = request("EXPENSE", null, "0.01");
    as(reviewer);
    assertThrows(
        ResponseStatusException.class,
        () -> execution.review(project, excess, new Decision(true, "Over budget")));
    mvc.perform(
            get("/api/projects/" + project + "/execution").with(user(manager.email).roles("ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.requests[0].amount").value("0.01"));
  }

  @Test
  void transferRetainsHistoryAndPreventsAbandonedTasks() {
    execution.assign(project, new Assignment(engineer.id));
    Long task = task("1");
    Long assignment =
        db.queryForObject(
            "select id from project_assignments where project_id=?", Long.class, project);
    assertThrows(ResponseStatusException.class, () -> execution.revoke(project, assignment));
    execution.assign(project, new Assignment(outsider.id));
    execution.transfer(project, task, new Assignment(outsider.id));
    execution.revoke(project, assignment);
    as(engineer);
    assertThrows(ResponseStatusException.class, () -> request("PROGRESS", task, "50"));
  }

  @Test
  void completionIsTransactionalAndRejectedCompletionCanBeResubmitted() {
    execution.assign(project, new Assignment(engineer.id));
    Long task = task("1");
    assertThrows(ResponseStatusException.class, () -> request("COMPLETION", null, null));
    as(engineer);
    Long progress = request("PROGRESS", task, "100");
    evidence(progress);
    approve(progress);
    as(engineer);
    Long complete = request("COMPLETION", null, null);
    evidence(complete);
    as(reviewer);
    execution.review(project, complete, new Decision(false, "Need final inspection"));
    assertEquals(
        "IN_PROGRESS",
        db.queryForObject("select status from projects where id=?", String.class, project));
    as(engineer);
    complete = request("COMPLETION", null, null);
    evidence(complete);
    approve(complete);
    assertEquals(
        "COMPLETED",
        db.queryForObject("select status from projects where id=?", String.class, project));
    assertNotNull(
        db.queryForObject(
            "select actual_end_date from projects where id=?", LocalDate.class, project));
    as(manager);
    assertThrows(ResponseStatusException.class, () -> task("1"));
  }

  @Test
  void extensionsPreserveOriginalScheduleAndDelayNotificationsAreDeduplicated() {
    db.update(
        "update projects set planned_end_date=? where id=?",
        LocalDate.now(clock).minusDays(1),
        project);
    delays.scan();
    delays.scan();
    assertEquals(
        1,
        db.queryForObject(
            "select count(*) from notifications where project_id=? and dedup_key is not null",
            Integer.class,
            project));
    Long req =
        execution.submit(
            project,
            new Request(
                "EXTENSION",
                null,
                null,
                LocalDate.now(clock).plusDays(20),
                "Rain delayed construction"));
    approve(req);
    assertEquals(
        LocalDate.now(clock).plusDays(20),
        db.queryForObject(
            "select revised_end_date from projects where id=?", LocalDate.class, project));
    assertEquals(
        1,
        db.queryForObject(
            "select count(*) from project_schedule_history where project_id=?",
            Integer.class,
            project));
  }

  @Test
  void evidenceAndReportsEnforceAccessAndCsrf() throws Exception {
    execution.assign(project, new Assignment(engineer.id));
    Long t = task("1");
    as(engineer);
    Long req =
        execution.submit(project, new Request("PROGRESS", t, new BigDecimal("50"), null, "=1+\n2"));
    assertThrows(
        ResponseStatusException.class,
        () -> execution.upload(project, req, "bad.html", "<html>bad</html>".getBytes()));
    evidence(req);
    Long file =
        db.queryForObject("select id from project_evidence where request_id=?", Long.class, req);
    mvc.perform(
            get("/api/projects/" + project + "/execution")
                .with(user(engineer.email).roles("ENGINEER")))
        .andExpect(status().isOk())
        .andExpect(
            jsonPath("$.tasks[0].due_date").value(LocalDate.now(clock).plusDays(1).toString()));
    mvc.perform(
            post("/api/projects/" + project + "/requests/" + req + "/review")
                .with(user(manager.email).roles("ADMIN"))
                .with(csrf())
                .contentType("application/json")
                .content("{\"note\":\"Missing explicit decision\"}"))
        .andExpect(status().isBadRequest());
    mvc.perform(
            get("/api/projects/" + project + "/evidence/" + file)
                .with(user(outsider.email).roles("ENGINEER")))
        .andExpect(status().isNotFound());
    mvc.perform(
            get("/api/projects/" + project + "/evidence/" + file)
                .with(user(engineer.email).roles("ENGINEER")))
        .andExpect(status().isOk())
        .andExpect(header().string("X-Content-Type-Options", "nosniff"));
    mvc.perform(
            multipart("/api/projects/" + project + "/requests/" + req + "/evidence")
                .file(
                    new MockMultipartFile(
                        "file", "p.pdf", "application/pdf", "%PDF-1.7 proof".getBytes()))
                .with(user(engineer.email).roles("ENGINEER")))
        .andExpect(status().isForbidden());
    mvc.perform(
            get("/api/projects/" + project + "/report.csv")
                .with(user(outsider.email).roles("ENGINEER")))
        .andExpect(status().isNotFound());
    mvc.perform(
            get("/api/projects/" + project + "/report.csv")
                .with(user(manager.email).roles("ADMIN")))
        .andExpect(status().isOk())
        .andExpect(content().string(org.hamcrest.Matchers.containsString("\"'=1+\n2\"")));
  }

  @Test
  void resourceUsageRejectsStaleWrites() {
    execution.resource(
        project,
        new Resource("MATERIAL", "Cement", "bags", new BigDecimal("20"), new BigDecimal("700.01")));
    Long resource =
        db.queryForObject(
            "select id from project_resources where project_id=?", Long.class, project);
    execution.usage(project, resource, new Usage(new BigDecimal("22"), 0L));
    assertThrows(
        ResponseStatusException.class,
        () -> execution.usage(project, resource, new Usage(new BigDecimal("21"), 0L)));
    assertEquals(
        new BigDecimal("22.00"),
        db.queryForObject(
            "select used from project_resources where id=?", BigDecimal.class, resource));
  }

  @Test
  void exportsProduceValidSpreadsheetXmlAndPdfCrossReference() throws Exception {
    byte[] workbook = reports.excel(project);
    int entries = 0;
    try (var zip = new java.util.zip.ZipInputStream(new java.io.ByteArrayInputStream(workbook))) {
      for (var entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry()) {
        var factory = javax.xml.parsers.DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.newDocumentBuilder().parse(new java.io.ByteArrayInputStream(zip.readAllBytes()));
        entries++;
      }
    }
    assertEquals(5, entries);
    String pdf = new String(reports.pdf(project), java.nio.charset.StandardCharsets.ISO_8859_1);
    assertTrue(pdf.startsWith("%PDF-1.4"));
    assertTrue(pdf.endsWith("%%EOF\n"));
    int start = pdf.lastIndexOf("startxref\n") + 10;
    int offset = Integer.parseInt(pdf.substring(start, pdf.indexOf('\n', start)));
    assertTrue(pdf.substring(offset).startsWith("xref\n"));
  }

  @Test
  void permissionToProceedRequiresCurrentPlanAndSufficientBudget() throws Exception {
    execution.assign(project, new Assignment(engineer.id));
    execution.task(
        project,
        new Task(
            "Electrical work",
            engineer.id,
            LocalDate.now(clock).plusDays(2),
            BigDecimal.ONE,
            null,
            new BigDecimal("500")));
    Long task =
        db.queryForObject(
            "select max(id) from project_tasks where project_id=?", Long.class, project);
    as(engineer);
    assertThrows(ResponseStatusException.class, () -> request("PROGRESS", task, "50"));
    Long stale = request("WORK_PLAN", task, null);
    as(manager);
    execution.resource(
        project,
        new Resource(
            "LABOR", "Electrician", "hours", new BigDecimal("2"), new BigDecimal("50"), task));
    as(reviewer);
    assertThrows(
        ResponseStatusException.class,
        () -> execution.review(project, stale, new Decision(true, "Proceed")));
    execution.review(project, stale, new Decision(false, "Resource plan changed"));
    as(engineer);
    Long plan = request("WORK_PLAN", task, null);
    as(reviewer);
    assertThrows(
        ResponseStatusException.class,
        () -> execution.review(project, plan, new Decision(true, "No budget yet")));
    as(manager);
    Long budget = request("BUDGET", null, "500");
    approve(budget);
    execution.review(project, plan, new Decision(true, "Dates, labor and materials checked"));
    as(engineer);
    request("PROGRESS", task, "50");
    String report =
        new String(reports.pdf(project, task), java.nio.charset.StandardCharsets.ISO_8859_1);
    assertTrue(report.contains("Electrical work"));
    assertTrue(report.contains("Planned labor cost"));
    assertTrue(report.contains("Work start"));
  }

  @Test
  void completionRequiresMatchedResourcesCurrentPlanAndPhoto() {
    execution.assign(project, new Assignment(engineer.id));
    Long task = task("1");
    execution.resource(
        project,
        new Resource("MATERIAL", "Blocks", "pieces", BigDecimal.ONE, BigDecimal.ZERO, task));
    as(engineer);
    Long plan = request("WORK_PLAN", task, null);
    approve(plan);
    as(engineer);
    Long progress = request("PROGRESS", task, "100");
    evidence(progress);
    approve(progress);
    as(engineer);
    assertThrows(ResponseStatusException.class, () -> request("COMPLETION", null, null));
    Long resource =
        db.queryForObject(
            "select id from project_resources where project_id=?", Long.class, project);
    execution.usage(project, resource, new Usage(BigDecimal.ONE, 0L));
    Long complete = request("COMPLETION", null, null);
    execution.upload(project, complete, "certificate.pdf", "%PDF-1.7 proof".getBytes());
    as(reviewer);
    assertThrows(
        ResponseStatusException.class,
        () -> execution.review(project, complete, new Decision(true, "PDF only")));
    as(engineer);
    evidence(complete);
    approve(complete);
    assertEquals(
        "COMPLETED",
        db.queryForObject("select status from projects where id=?", String.class, project));
  }

  @Test
  void delayExplanationIsRequiredWithoutChangingDeadline() {
    execution.assign(project, new Assignment(engineer.id));
    Long task = task("1");
    LocalDate oldDeadline = LocalDate.now(clock).minusDays(1);
    db.update("update projects set planned_end_date=? where id=?", oldDeadline, project);
    as(engineer);
    assertThrows(ResponseStatusException.class, () -> request("PROGRESS", task, "50"));
    Long reason = request("DELAY_REASON", null, null);
    approve(reason);
    assertEquals(
        oldDeadline,
        db.queryForObject(
            "select planned_end_date from projects where id=?", LocalDate.class, project));
    assertNull(
        db.queryForObject(
            "select revised_end_date from projects where id=?", LocalDate.class, project));
    as(engineer);
    request("PROGRESS", task, "50");
  }

  @Test
  void resourceAndWorkRevisionsAreAuditedAndRequireReapproval() {
    execution.assign(project, new Assignment(engineer.id));
    Long task = task("1");
    execution.resource(
        project, new Resource("LABOR", "Mason", "days", BigDecimal.ONE, BigDecimal.ZERO, task));
    Long resource =
        db.queryForObject(
            "select id from project_resources where project_id=?", Long.class, project);
    execution.reviseResource(
        project,
        resource,
        new ResourceRevision(new BigDecimal("2"), BigDecimal.ZERO, 0L, "Additional day"));
    assertEquals(
        1,
        db.queryForObject(
            "select count(*) from resource_plan_history where resource_id=?",
            Integer.class,
            resource));
    long version =
        db.queryForObject("select version from project_tasks where id=?", Long.class, task);
    execution.reviseWork(
        project,
        task,
        new WorkRevision(
            LocalDate.now(clock),
            LocalDate.now(clock).plusDays(3),
            BigDecimal.ZERO,
            version,
            "Updated sequence"));
    assertEquals(
        1,
        db.queryForObject(
            "select count(*) from work_plan_history where task_id=?", Integer.class, task));
    as(engineer);
    assertThrows(ResponseStatusException.class, () -> request("PROGRESS", task, "50"));
  }

  @Test
  void aheadAndOverdueConditionsUseTheEffectiveSchedule() {
    var p = new Project();
    p.status = Project.Status.IN_PROGRESS;
    p.plannedStartDate = LocalDate.now(clock).minusDays(1);
    p.plannedEndDate = LocalDate.now(clock).plusDays(8);
    p.progress = new BigDecimal("80");
    assertEquals(Project.ScheduleCondition.AHEAD_OF_SCHEDULE, projects.condition(p));
    p.plannedEndDate = LocalDate.now(clock).minusDays(1);
    assertEquals(Project.ScheduleCondition.DELAYED, projects.condition(p));
    p.revisedEndDate = LocalDate.now(clock).plusDays(8);
    assertEquals(Project.ScheduleCondition.AHEAD_OF_SCHEDULE, projects.condition(p));
  }
}
