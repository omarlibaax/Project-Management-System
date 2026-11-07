package com.pms;

import static com.pms.projects.Project.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.pms.projects.*;
import com.pms.projects.ProjectDtos.*;
import com.pms.users.*;
import com.pms.users.UserDtos.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@WithMockUser(username = "phase2-super@example.test", roles = "SUPER_ADMIN")
class PhaseTwoTests {
  @Test
  void developmentProjectSeedIsIdempotent() throws Exception {
    var environment = new org.springframework.mock.env.MockEnvironment()
        .withProperty("PMS_SEED_ADMIN_EMAIL", "phase2-super@example.test");
    var seed = new com.pms.config.DevelopmentProjectSeed(repository, users, environment, jdbc, clock,
        new com.pms.audit.AuditService(jdbc));
    seed.run();
    assertEquals(55, repository.count());
    seed.run();
    assertEquals(55, repository.count());
  }

  @Test
  void roleChangeInvalidatesTheOldSessionAuthorities() throws Exception {
    accounts.update(engineer.id, new UpdateUser(engineer.fullName, null, null, null,
        Set.of("ADMIN", "ENGINEER"), engineer.version));
    mvc.perform(get("/api/auth/me").with(user(engineer.email).roles("ENGINEER")))
        .andExpect(status().isUnauthorized());
  }
  @Autowired MockMvc mvc;
  @Autowired UserRepository users;
  @Autowired UserService accounts;
  @Autowired ProjectService projects;
  @Autowired ProjectRepository repository;
  @Autowired DashboardService dashboard;
  @Autowired PasswordEncoder passwords;
  @Autowired JdbcTemplate jdbc;
  @Autowired Clock clock;
  AppUser admin, engineer, manager;

  @BeforeEach
  void setup() {
    admin = account("phase2-super@example.test", "SUPER_ADMIN");
    engineer = account("phase2-engineer@example.test", "ENGINEER");
    manager = account("phase2-manager@example.test", "ADMIN");
  }

  AppUser account(String email, String role) {
    var u = new AppUser();
    u.email = email;
    u.employeeCode = UUID.randomUUID().toString();
    u.fullName = role + " test account";
    u.passwordHash = passwords.encode("Phase-two-password-21");
    u.roles.add(role);
    return users.saveAndFlush(u);
  }

  ProjectInput input(
      String name,
      LocalDate start,
      LocalDate end,
      Status status,
      BigDecimal budget,
      Long version,
      String reason) {
    return new ProjectInput(
        name,
        "Engineering works",
        "Construction",
        "Nairobi",
        "Client",
        manager.id,
        start,
        end,
        Priority.HIGH,
        status,
        budget,
        reason,
        version);
  }

  ProjectView create() {
    var today = LocalDate.now(clock);
    return projects.create(
        input(
            "Test foundation",
            today,
            today.plusDays(30),
            Status.PLANNED,
            new BigDecimal("250000.50"),
            null,
            null));
  }

  @Test
  void createsAndFiltersProjectWithUniqueCodes() throws Exception {
    var a = create();
    var b = create();
    assertNotEquals(a.code(), b.code());
    assertEquals(31, a.plannedDuration());
    assertEquals("250000.50", a.plannedBudget().toPlainString());
    mvc.perform(
            get("/api/projects")
                .param("search", a.code())
                .param("status", "PLANNED")
                .param("priority", "HIGH"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(1))
        .andExpect(jsonPath("$.items[0].plannedBudget").value("250000.50"));
  }

  @Test
  void rejectsInvalidDatesAndDirectCompletion() {
    var today = LocalDate.now(clock);
    assertThrows(
        ResponseStatusException.class,
        () ->
            projects.create(
                input(
                    "Bad dates",
                    today,
                    today.minusDays(1),
                    Status.PLANNED,
                    BigDecimal.ZERO,
                    null,
                    null)));
    assertThrows(
        ResponseStatusException.class,
        () ->
            projects.create(
                input("Bypass", today, today, Status.COMPLETED, BigDecimal.ZERO, null, null)));
    assertThrows(
        ResponseStatusException.class,
        () ->
            projects.create(
                input(
                    "Bypass", today, today, Status.PENDING_APPROVAL, BigDecimal.ZERO, null, null)));
  }

  @Test
  void rejectsInvalidManager() {
    var today = LocalDate.now(clock);
    var request =
        new ProjectInput(
            "Bad manager",
            "",
            "Construction",
            "Nairobi",
            "Client",
            engineer.id,
            today,
            today,
            Priority.LOW,
            Status.PLANNED,
            BigDecimal.ZERO,
            null,
            null);
    assertThrows(ResponseStatusException.class, () -> projects.create(request));
  }

  @Test
  void engineerCannotReadOrModifyUnassignedProjects() throws Exception {
    var p = create();
    mvc.perform(get("/api/projects").with(user(engineer.email).roles("ENGINEER")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(0));
    mvc.perform(get("/api/projects/" + p.id()).with(user(engineer.email).roles("ENGINEER")))
        .andExpect(status().isNotFound());
    mvc.perform(
            get("/api/projects/" + p.id() + "/schedule-history")
                .with(user(engineer.email).roles("ENGINEER")))
        .andExpect(status().isNotFound());
    mvc.perform(
            patch("/api/projects/" + p.id() + "/archive")
                .with(user(engineer.email).roles("ENGINEER"))
                .with(csrf())
                .contentType("application/json")
                .content("{\"version\":0}"))
        .andExpect(status().isForbidden());
    mvc.perform(get("/api/dashboard/admin").with(user(engineer.email).roles("ENGINEER")))
        .andExpect(status().isForbidden());
  }

  @Test
  void scheduleEditsPreserveOriginalDatesAndAuthor() {
    var p = create();
    var start = p.plannedStartDate();
    assertThrows(
        ResponseStatusException.class,
        () ->
            projects.update(
                p.id(),
                input(
                    p.name(),
                    start,
                    p.plannedEndDate().plusDays(2),
                    Status.PLANNED,
                    p.plannedBudget(),
                    p.version(),
                    "")));
    var changed =
        projects.update(
            p.id(),
            input(
                p.name(),
                start,
                p.plannedEndDate().plusDays(2),
                Status.PLANNED,
                p.plannedBudget(),
                p.version(),
                "Client approved schedule correction"));
    assertEquals(p.plannedEndDate(), changed.originalEndDate());
    assertEquals(1, projects.history(p.id()).size());
    assertEquals(admin.fullName, projects.history(p.id()).getFirst().changedBy());
    assertThrows(
        ResponseStatusException.class,
        () ->
            projects.update(
                p.id(),
                input(
                    p.name(),
                    start,
                    changed.plannedEndDate(),
                    Status.PLANNED,
                    p.plannedBudget(),
                    p.version(),
                    "")));
  }

  @Test
  void archiveRetainsRecordAndExcludesItFromLivePortfolio() {
    var before = dashboard.admin("KES").total();
    var p = create();
    projects.archive(p.id(), new ArchiveInput(p.version()));
    assertTrue(projects.get(p.id()).archived());
    assertTrue(repository.existsById(p.id()));
    assertEquals(before, dashboard.admin("KES").total());
    assertEquals(1, projects.list(p.code(), null, null, true, "createdAt", "desc", 0, 20).total());
  }

  @Test
  void delayedConditionRemainsSeparateFromStatus() {
    var today = LocalDate.now(clock);
    var p =
        projects.create(
            input(
                "Overdue works",
                today.minusDays(10),
                today.minusDays(1),
                Status.IN_PROGRESS,
                BigDecimal.ZERO,
                null,
                null));
    assertEquals(Status.IN_PROGRESS, p.status());
    assertEquals(ScheduleCondition.DELAYED, p.scheduleCondition());
    assertEquals(today, p.actualStartDate());
  }

  @Test
  void supportsMoreThanFiftyProjectsAndAccurateAggregateMoney() {
    var before = dashboard.admin("KES");
    var today = LocalDate.now(clock);
    var amount = new BigDecimal("9007199254740993.01");
    for (int i = 0; i < 55; i++)
      projects.create(
          input("Portfolio " + i, today, today.plusDays(20), Status.PLANNED, amount, null, null));
    var summary = dashboard.admin("KES");
    assertEquals(before.total() + 55, summary.total());
    assertEquals(
        0,
        before
            .plannedBudget()
            .add(amount.multiply(BigDecimal.valueOf(55)))
            .compareTo(summary.plannedBudget()));
    assertEquals(
        20, projects.list("Portfolio", null, null, false, "name", "asc", 0, 20).items().size());
    assertEquals(
        15, projects.list("Portfolio", null, null, false, "name", "asc", 2, 20).items().size());
  }

  @Test
  void createsHashedAccountsAndRejectsDuplicates() {
    var request =
        new CreateUser(
            "NEW-001",
            "New Engineer",
            "new@example.test",
            "123",
            null,
            "Engineer",
            Set.of("ENGINEER"),
            "New-account-password-21");
    var created = accounts.create(request);
    var stored = users.findById(created.id()).orElseThrow();
    assertNotEquals(request.password(), stored.passwordHash);
    assertTrue(passwords.matches(request.password(), stored.passwordHash));
    assertThrows(ResponseStatusException.class, () -> accounts.create(request));
    assertTrue(
        jdbc.queryForObject(
            "select count(*)>0 from audit_logs where actor_id=? and action=?",
            Boolean.class,
            admin.id,
            "USER_CREATED:" + created.id()));
  }

  @Test
  void editsRolesSuspendsAndReactivatesWithAudit() {
    var changed =
        accounts.update(
            engineer.id,
            new UpdateUser(
                "Updated Engineer",
                "123",
                null,
                "Lead",
                Set.of("ADMIN", "ENGINEER"),
                engineer.version));
    assertEquals(2, changed.roles().size());
    var suspended = accounts.status(engineer.id, new AccountStatus(false, changed.version()));
    assertFalse(suspended.active());
    assertTrue(accounts.status(engineer.id, new AccountStatus(true, suspended.version())).active());
  }

  @Test
  void cannotRemoveOwnAdministrativeAccess() {
    assertThrows(
        ResponseStatusException.class,
        () -> accounts.status(admin.id, new AccountStatus(false, admin.version)));
    assertThrows(
        ResponseStatusException.class,
        () ->
            accounts.update(
                admin.id,
                new UpdateUser(
                    admin.fullName, null, null, null, Set.of("ENGINEER"), admin.version)));
  }

  @Test
  void managersCannotManageUsersButCanReadEngineerDirectory() throws Exception {
    mvc.perform(get("/api/users").with(user(manager.email).roles("ADMIN")))
        .andExpect(status().isForbidden());
    mvc.perform(get("/api/engineers").with(user(manager.email).roles("ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].passwordHash").doesNotExist());
    mvc.perform(get("/api/engineers").with(user(engineer.email).roles("ENGINEER")))
        .andExpect(status().isForbidden());
  }

  @Test
  void validationRejectsNegativeBudgetsAndInvalidPaging() throws Exception {
    mvc.perform(get("/api/projects").param("size", "101")).andExpect(status().isBadRequest());
    mvc.perform(get("/api/projects").param("sort", "passwordHash"))
        .andExpect(status().isBadRequest());
    mvc.perform(
            post("/api/projects")
                .with(csrf())
                .contentType("application/json")
                .content(
                    """
                    {"name":"Negative budget","description":"","category":"Works","location":"Nairobi","client":"Client","managerId":1,"plannedStartDate":"2026-01-01","plannedEndDate":"2026-01-02","priority":"HIGH","status":"PLANNED","plannedBudget":"-1"}
                    """))
        .andExpect(status().isBadRequest());
  }
}
