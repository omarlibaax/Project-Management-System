package com.pms.execution;

import static org.springframework.http.HttpStatus.*;

import com.pms.audit.AuditService;
import com.pms.common.CurrentActor;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class ExecutionService {
  private final JdbcTemplate db;
  private final CurrentActor actor;
  private final AuditService audit;
  private final Clock clock;

  public ExecutionService(JdbcTemplate db, CurrentActor actor, AuditService audit, Clock clock) {
    this.db = db;
    this.actor = actor;
    this.audit = audit;
    this.clock = clock;
  }

  public record Assignment(@NotNull Long engineerId) {}

  public record Task(
      @NotBlank @Size(max = 240) String title,
      @NotNull Long engineerId,
      @NotNull LocalDate dueDate,
      @NotNull @DecimalMin("0.01") @Digits(integer = 7, fraction = 2) BigDecimal weight,
      LocalDate startDate,
      @DecimalMin("0") @Digits(integer = 17, fraction = 2) BigDecimal plannedBudget) {
    public Task(String title, Long engineerId, LocalDate dueDate, BigDecimal weight) {
      this(title, engineerId, dueDate, weight, null, BigDecimal.ZERO);
    }
  }

  public record Resource(
      @NotBlank String kind,
      @NotBlank @Size(max = 240) String name,
      @NotBlank @Size(max = 40) String unit,
      @NotNull @DecimalMin("0") @Digits(integer = 12, fraction = 2) BigDecimal planned,
      @NotNull @DecimalMin("0") @Digits(integer = 17, fraction = 2) BigDecimal unitCost,
      Long taskId) {
    public Resource(
        String kind, String name, String unit, BigDecimal planned, BigDecimal unitCost) {
      this(kind, name, unit, planned, unitCost, null);
    }
  }

  public record Usage(
      @NotNull @DecimalMin("0") @Digits(integer = 12, fraction = 2) BigDecimal used,
      @NotNull Long version) {}

  public record ResourceRevision(
      @NotNull @DecimalMin("0") @Digits(integer = 12, fraction = 2) BigDecimal planned,
      @NotNull @DecimalMin("0") @Digits(integer = 17, fraction = 2) BigDecimal unitCost,
      @NotNull Long version,
      @NotBlank @Size(max = 1000) String reason) {}

  public record WorkRevision(
      @NotNull LocalDate startDate,
      @NotNull LocalDate dueDate,
      @NotNull @DecimalMin("0") @Digits(integer = 17, fraction = 2) BigDecimal plannedBudget,
      @NotNull Long version,
      @NotBlank @Size(max = 1000) String reason) {}

  public record Request(
      @NotBlank String kind,
      Long taskId,
      @DecimalMin("0") @Digits(integer = 17, fraction = 2) BigDecimal amount,
      LocalDate requestedDate,
      @NotBlank @Size(max = 1000) String reason) {}

  public record Decision(@NotNull Boolean approve, @NotBlank @Size(max = 2000) String note) {}

  private void require(boolean ok, org.springframework.http.HttpStatus status, String message) {
    if (!ok) throw new ResponseStatusException(status, message);
  }

  private void manager() {
    require(actor.manager(), FORBIDDEN, "Management access required");
  }

  private boolean assigned(Long project, Long user) {
    return Boolean.TRUE.equals(
        db.queryForObject(
            "select exists(select 1 from project_assignments where project_id=? and engineer_id=?"
                + " and revoked_at is null)",
            Boolean.class,
            project,
            user));
  }

  private Map<String, Object> project(Long id, boolean write) {
    var rows =
        db.queryForList("select * from projects where id=?" + (write ? " for update" : ""), id);
    require(
        !rows.isEmpty() && (actor.manager() || assigned(id, actor.user().id)),
        NOT_FOUND,
        "Project not found");
    var p = rows.getFirst();
    if (write)
      require(
          !Boolean.TRUE.equals(p.get("archived"))
              && !Set.of("COMPLETED", "CANCELLED").contains(p.get("status")),
          CONFLICT,
          "Project is read-only");
    return p;
  }

  private void editable(Map<String, Object> p) {
    require(!"PENDING_APPROVAL".equals(p.get("status")), CONFLICT, "Completion is awaiting review");
  }

  private void activeEngineer(Long id) {
    require(
        Boolean.TRUE.equals(
            db.queryForObject(
                "select exists(select 1 from users u join user_roles r on r.user_id=u.id where"
                    + " u.id=? and u.active and r.role_name='ENGINEER')",
                Boolean.class,
                id)),
        BAD_REQUEST,
        "Select an active engineer");
  }

  private void changed(Long id, String action) {
    db.update("update projects set version=version+1,updated_at=current_timestamp where id=?", id);
    audit.record(actor.user().id, action + ":" + id);
  }

  private void notify(Long user, Long project, String message) {
    db.update(
        "insert into notifications(user_id,project_id,message) values (?,?,?)",
        user,
        project,
        message);
  }

  public Map<String, Object> workspace(Long id) {
    project(id, false);
    return Map.of(
        "assignments",
            db.queryForList(
                "select a.id,a.engineer_id,u.full_name,a.assigned_at,a.revoked_at from"
                    + " project_assignments a join users u on u.id=a.engineer_id where"
                    + " a.project_id=? order by a.id desc",
                id),
        "tasks",
            db.queryForList(
                "select t.*,u.full_name from project_tasks t join users u on u.id=t.engineer_id"
                    + " where t.project_id=? order by t.id",
                id),
        "resources",
            db.queryForList(
                "select *, (used-planned)::text as variance, (used*unit_cost)::text as usage_cost"
                    + " from project_resources where project_id=? order by id",
                id),
        "requests",
            db.queryForList(
                "select r.*,u.full_name, v.full_name as reviewer_name,(select count(*) from"
                    + " project_evidence e where e.request_id=r.id) as evidence_count from"
                    + " project_requests r join users u on u.id=r.submitted_by left join users v on"
                    + " v.id=r.reviewed_by where r.project_id=? order by r.id desc",
                id),
        "evidence",
            db.queryForList(
                "select e.id,e.request_id,e.name,e.media_type from project_evidence e join"
                    + " project_requests r on r.id=e.request_id where r.project_id=? order by e.id",
                id),
        "resourceHistory",
            db.queryForList(
                "select h.*,u.full_name from resource_plan_history h join project_resources r on"
                    + " r.id=h.resource_id join users u on u.id=h.changed_by where r.project_id=?"
                    + " order by h.id desc",
                id),
        "workHistory",
            db.queryForList(
                "select h.*,u.full_name from work_plan_history h join project_tasks t on"
                    + " t.id=h.task_id join users u on u.id=h.changed_by where t.project_id=? order"
                    + " by h.id desc",
                id));
  }

  @Transactional
  public void assign(Long id, Assignment input) {
    manager();
    editable(project(id, true));
    activeEngineer(input.engineerId());
    db.update(
        "insert into project_assignments(project_id,engineer_id,assigned_by) values (?,?,?)",
        id,
        input.engineerId(),
        actor.user().id);
    notify(input.engineerId(), id, "You were assigned to this project");
    changed(id, "ENGINEER_ASSIGNED");
  }

  @Transactional
  public void revoke(Long id, Long assignment) {
    manager();
    editable(project(id, true));
    var rows =
        db.queryForList(
            "select engineer_id from project_assignments where id=? and project_id=? and revoked_at"
                + " is null",
            assignment,
            id);
    require(!rows.isEmpty(), NOT_FOUND, "Active assignment not found");
    Long engineer = ((Number) rows.getFirst().get("engineer_id")).longValue();
    require(
        db.queryForObject(
                "select count(*) from project_tasks where project_id=? and engineer_id=? and"
                    + " progress<100",
                Long.class,
                id,
                engineer)
            == 0,
        CONFLICT,
        "Transfer unfinished tasks before revoking this assignment");
    db.update("update project_assignments set revoked_at=current_timestamp where id=?", assignment);
    notify(engineer, id, "Your project assignment was revoked");
    changed(id, "ENGINEER_REVOKED");
  }

  @Transactional
  public void task(Long id, Task input) {
    manager();
    var p = project(id, true);
    editable(p);
    activeEngineer(input.engineerId());
    require(
        assigned(id, input.engineerId()),
        BAD_REQUEST,
        "Task owner must be assigned to the project");
    var start = ((java.sql.Date) p.get("planned_start_date")).toLocalDate();
    var end =
        ((java.sql.Date)
                (p.get("revised_end_date") == null
                    ? p.get("planned_end_date")
                    : p.get("revised_end_date")))
            .toLocalDate();
    require(
        !input.dueDate().isBefore(start) && !input.dueDate().isAfter(end),
        BAD_REQUEST,
        "Task due date must be within the project schedule");
    LocalDate taskStart = input.startDate() == null ? start : input.startDate();
    require(
        !taskStart.isBefore(start) && !taskStart.isAfter(input.dueDate()),
        BAD_REQUEST,
        "Work start must be within the project schedule and before its end");
    db.update(
        "insert into"
            + " project_tasks(project_id,title,engineer_id,due_date,weight,start_date,planned_budget)"
            + " values (?,?,?,?,?,?,?)",
        id,
        input.title().trim(),
        input.engineerId(),
        input.dueDate(),
        input.weight(),
        taskStart,
        input.plannedBudget() == null ? BigDecimal.ZERO : input.plannedBudget());
    progress(id);
    changed(id, "TASK_CREATED");
    notify(input.engineerId(), id, "A task was assigned to you: " + input.title());
  }

  @Transactional
  public void transfer(Long id, Long task, Assignment input) {
    manager();
    editable(project(id, true));
    activeEngineer(input.engineerId());
    require(
        assigned(id, input.engineerId()),
        BAD_REQUEST,
        "New owner must be assigned to this project");
    require(
        db.queryForObject(
                "select count(*) from project_requests where task_id=? and state='PENDING'",
                Long.class,
                task)
            == 0,
        CONFLICT,
        "Review pending task progress before transfer");
    require(
        db.update(
                "update project_tasks set engineer_id=?,authorized_plan=null,version=version+1"
                    + " where id=? and project_id=?",
                input.engineerId(),
                task,
                id)
            == 1,
        NOT_FOUND,
        "Task not found");
    changed(id, "TASK_TRANSFERRED");
    notify(input.engineerId(), id, "A task was transferred to you");
  }

  private void progress(Long id) {
    db.update(
        "update projects set progress=coalesce((select"
            + " round(sum(weight*progress)/nullif(sum(weight),0),2) from project_tasks where"
            + " project_id=?),0) where id=?",
        id,
        id);
  }

  @Transactional
  public void resource(Long id, Resource input) {
    manager();
    editable(project(id, true));
    require(
        Set.of("LABOR", "MATERIAL").contains(input.kind()), BAD_REQUEST, "Invalid resource kind");
    if (input.taskId() != null)
      require(
          db.queryForObject(
                  "select count(*) from project_tasks where id=? and project_id=?",
                  Long.class,
                  input.taskId(),
                  id)
              == 1,
          NOT_FOUND,
          "Work item not found in this project");
    db.update(
        "insert into project_resources(project_id,kind,name,unit,planned,unit_cost,task_id) values"
            + " (?,?,?,?,?,?,?)",
        id,
        input.kind(),
        input.name().trim(),
        input.unit().trim(),
        input.planned(),
        input.unitCost(),
        input.taskId());
    if (input.taskId() != null)
      db.update(
          "update project_tasks set authorized_plan=null,version=version+1 where id=?",
          input.taskId());
    changed(id, "RESOURCE_PLANNED");
  }

  @Transactional
  public void usage(Long id, Long resource, Usage input) {
    editable(project(id, true));
    require(
        db.update(
                "update project_resources set used=?,version=version+1 where id=? and project_id=?"
                    + " and version=?",
                input.used(),
                resource,
                id,
                input.version())
            == 1,
        CONFLICT,
        "Resource changed. Reload before saving.");
    changed(id, "RESOURCE_USAGE_RECORDED");
  }

  private String plan(Long project, Long task) {
    return db.queryForObject(
        """
        select jsonb_build_object('title',t.title,'engineer',t.engineer_id,
        'start',t.start_date,'end',t.due_date,'budget',t.planned_budget,
        'resources',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,
        'name',r.name,'unit',r.unit,'quantity',r.planned,'unitCost',r.unit_cost) order by r.id),'[]'::jsonb)
        from project_resources r where r.task_id=t.id and r.project_id=t.project_id))::text
        from project_tasks t where t.id=? and t.project_id=?
        """,
        String.class,
        task,
        project);
  }

  @Transactional
  public void reviseWork(Long id, Long task, WorkRevision input) {
    manager();
    var p = project(id, true);
    editable(p);
    var rows = db.queryForList("select * from project_tasks where id=? and project_id=?", task, id);
    require(!rows.isEmpty(), NOT_FOUND, "Work item not found");
    var old = rows.getFirst();
    require(
        ((Number) old.get("version")).longValue() == input.version(),
        CONFLICT,
        "Work item changed. Reload before saving");
    var projectStart = ((java.sql.Date) p.get("planned_start_date")).toLocalDate();
    var projectEnd =
        ((java.sql.Date)
                (p.get("revised_end_date") == null
                    ? p.get("planned_end_date")
                    : p.get("revised_end_date")))
            .toLocalDate();
    require(
        !input.startDate().isBefore(projectStart)
            && !input.dueDate().isAfter(projectEnd)
            && !input.dueDate().isBefore(input.startDate()),
        BAD_REQUEST,
        "Work dates must be within the project schedule");
    String previous = plan(id, task);
    db.update(
        "update project_tasks set"
            + " start_date=?,due_date=?,planned_budget=?,authorized_plan=null,version=version+1"
            + " where id=?",
        input.startDate(),
        input.dueDate(),
        input.plannedBudget(),
        task);
    db.update(
        "insert into work_plan_history(task_id,previous_plan,new_plan,reason,changed_by) values"
            + " (?,?,?,?,?)",
        task,
        previous,
        plan(id, task),
        input.reason(),
        actor.user().id);
    changed(id, "WORK_PLAN_REVISED");
  }

  private void matchedResources(Long id) {
    require(
        db.queryForObject(
                "select count(*) from project_resources where project_id=? and used<>planned",
                Long.class,
                id)
            == 0,
        CONFLICT,
        "Labor and material usage must match the resource plan before completion. Correct or"
            + " reconcile the resource records first");
    for (var task :
        db.queryForList("select id,authorized_plan from project_tasks where project_id=?", id))
      require(
          Objects.equals(
              task.get("authorized_plan"), plan(id, ((Number) task.get("id")).longValue())),
          CONFLICT,
          "Approve all current work plans before completion");
  }

  @Transactional
  public void reviseResource(Long id, Long resource, ResourceRevision input) {
    manager();
    editable(project(id, true));
    var rows =
        db.queryForList(
            "select * from project_resources where id=? and project_id=?", resource, id);
    require(!rows.isEmpty(), NOT_FOUND, "Resource not found");
    var old = rows.getFirst();
    require(
        ((Number) old.get("version")).longValue() == input.version(),
        CONFLICT,
        "Resource changed. Reload before saving");
    db.update(
        "insert into"
            + " resource_plan_history(resource_id,previous_planned,new_planned,previous_unit_cost,new_unit_cost,reason,changed_by)"
            + " values (?,?,?,?,?,?,?)",
        resource,
        old.get("planned"),
        input.planned(),
        old.get("unit_cost"),
        input.unitCost(),
        input.reason(),
        actor.user().id);
    db.update(
        "update project_resources set planned=?,unit_cost=?,version=version+1 where id=?",
        input.planned(),
        input.unitCost(),
        resource);
    if (old.get("task_id") != null)
      db.update(
          "update project_tasks set authorized_plan=null,version=version+1 where id=?",
          old.get("task_id"));
    changed(id, "RESOURCE_PLAN_REVISED");
  }

  @Transactional
  public Long submit(Long id, Request input) {
    var p = project(id, true);
    editable(p);
    require(
        Set.of(
                "PROGRESS",
                "EXPENSE",
                "BUDGET",
                "EXTENSION",
                "COMPLETION",
                "WORK_PLAN",
                "DELAY_REASON")
            .contains(input.kind()),
        BAD_REQUEST,
        "Invalid request kind");
    var deadline =
        ((java.sql.Date)
                (p.get("revised_end_date") == null
                    ? p.get("planned_end_date")
                    : p.get("revised_end_date")))
            .toLocalDate();
    if (!actor.manager()
        && LocalDate.now(clock).isAfter(deadline)
        && Set.of("PROGRESS", "COMPLETION").contains(input.kind()))
      require(
          db.queryForObject(
                  "select count(*) from project_requests where project_id=? and submitted_by=? and"
                      + " kind in ('DELAY_REASON','EXTENSION') and state<>'REJECTED' and"
                      + " submitted_at>=?",
                  Long.class,
                  id,
                  actor.user().id,
                  java.sql.Timestamp.from(
                      deadline.plusDays(1).atStartOfDay(clock.getZone()).toInstant()))
              > 0,
          CONFLICT,
          "This project is delayed. Submit a delay explanation before reporting further progress or"
              + " completion");
    switch (input.kind()) {
      case "PROGRESS" -> {
        require(
            input.taskId() != null
                && input.amount() != null
                && input.amount().compareTo(new BigDecimal("100")) <= 0,
            BAD_REQUEST,
            "Select a task and progress from 0 to 100");
        var tasks =
            db.queryForList(
                "select * from project_tasks where id=? and project_id=?", input.taskId(), id);
        require(!tasks.isEmpty(), NOT_FOUND, "Task not found");
        var t = tasks.getFirst();
        require(
            t.get("authorized_plan") != null
                && t.get("authorized_plan").equals(plan(id, input.taskId())),
            CONFLICT,
            "The manager must approve the current work plan before progress is submitted");
        require(
            actor.manager() || ((Number) t.get("engineer_id")).longValue() == actor.user().id,
            FORBIDDEN,
            "Only the task owner can submit progress");
        require(
            input.amount().compareTo((BigDecimal) t.get("progress")) > 0,
            CONFLICT,
            "Progress must increase");
      }
      case "BUDGET", "EXPENSE" -> {
        if (input.kind().equals("BUDGET")) manager();
        require(
            input.amount() != null && input.amount().signum() > 0,
            BAD_REQUEST,
            "Enter a positive amount");
      }
      case "WORK_PLAN" -> {
        require(input.taskId() != null, BAD_REQUEST, "Select a work item");
        var tasks =
            db.queryForList(
                "select * from project_tasks where id=? and project_id=?", input.taskId(), id);
        require(!tasks.isEmpty(), NOT_FOUND, "Work item not found");
        require(
            actor.manager()
                || ((Number) tasks.getFirst().get("engineer_id")).longValue() == actor.user().id,
            FORBIDDEN,
            "Only the assigned engineer can submit this work plan");
      }
      case "DELAY_REASON" ->
          require(
              LocalDate.now(clock)
                  .isAfter(
                      ((java.sql.Date)
                              (p.get("revised_end_date") == null
                                  ? p.get("planned_end_date")
                                  : p.get("revised_end_date")))
                          .toLocalDate()),
              CONFLICT,
              "This project is not overdue");
      case "EXTENSION" ->
          require(
              input.requestedDate() != null
                  && input
                      .requestedDate()
                      .isAfter(
                          ((java.sql.Date)
                                  (p.get("revised_end_date") == null
                                      ? p.get("planned_end_date")
                                      : p.get("revised_end_date")))
                              .toLocalDate()),
              BAD_REQUEST,
              "Extension must be after the current deadline");
      case "COMPLETION" -> {
        matchedResources(id);
        require(
            "IN_PROGRESS".equals(p.get("status")),
            CONFLICT,
            "Only an in-progress project can be submitted for completion");
        require(
            db.queryForObject(
                        "select count(*) from project_tasks where project_id=?", Long.class, id)
                    > 0
                && db.queryForObject(
                        "select count(*) from project_tasks where project_id=? and progress<100",
                        Long.class,
                        id)
                    == 0,
            CONFLICT,
            "Complete all tasks first");
        require(
            db.queryForObject(
                    "select count(*) from project_requests where project_id=? and state='PENDING'",
                    Long.class,
                    id)
                == 0,
            CONFLICT,
            "Review pending requests first");
        db.update("update projects set status='PENDING_APPROVAL' where id=?", id);
      }
      default -> throw new IllegalStateException();
    }
    Long request =
        db.queryForObject(
            "insert into"
                + " project_requests(project_id,kind,task_id,amount,requested_date,reason,submitted_by)"
                + " values (?,?,?,?,?,?,?) returning id",
            Long.class,
            id,
            input.kind(),
            Set.of("PROGRESS", "WORK_PLAN").contains(input.kind()) ? input.taskId() : null,
            input.amount(),
            input.requestedDate(),
            input.reason().trim(),
            actor.user().id);
    if (input.kind().equals("WORK_PLAN"))
      db.update(
          "update project_requests set plan_snapshot=? where id=?",
          plan(id, input.taskId()),
          request);
    notify(((Number) p.get("manager_id")).longValue(), id, input.kind() + " request submitted");
    changed(id, "REQUEST_SUBMITTED");
    return request;
  }

  @Transactional
  public void review(Long id, Long request, Decision input) {
    manager();
    var p = project(id, true);
    var rows =
        db.queryForList(
            "select * from project_requests where id=? and project_id=? for update", request, id);
    require(!rows.isEmpty(), NOT_FOUND, "Request not found");
    var r = rows.getFirst();
    require("PENDING".equals(r.get("state")), CONFLICT, "Request was already reviewed");
    require(
        ((Number) r.get("submitted_by")).longValue() != actor.user().id,
        FORBIDDEN,
        "A different manager must review this request");
    String kind = (String) r.get("kind");
    BigDecimal amount = (BigDecimal) r.get("amount");
    if (input.approve())
      switch (kind) {
        case "WORK_PLAN" -> {
          Long task = ((Number) r.get("task_id")).longValue();
          require(
              Objects.equals(r.get("plan_snapshot"), plan(id, task)),
              CONFLICT,
              "The work plan changed. Reject this request and submit the current plan");
          BigDecimal budget =
              db.queryForObject(
                  "select planned_budget from project_tasks where id=?", BigDecimal.class, task);
          BigDecimal cost =
              db.queryForObject(
                  "select coalesce(sum(planned*unit_cost),0) from project_resources where"
                      + " project_id=? and task_id=?",
                  BigDecimal.class,
                  id,
                  task);
          require(
              cost.compareTo(budget) <= 0,
              CONFLICT,
              "Work budget must cover planned labor and materials");
          BigDecimal allocated =
              db.queryForObject(
                  "select (select coalesce(sum(planned_budget),0) from project_tasks where"
                      + " project_id=?)+(select coalesce(sum(planned*unit_cost),0) from"
                      + " project_resources where project_id=? and task_id is null)",
                  BigDecimal.class,
                  id,
                  id);
          require(
              allocated.compareTo((BigDecimal) p.get("approved_budget")) <= 0,
              CONFLICT,
              "Work allocations exceed the approved project budget");
          db.update(
              "update project_tasks set authorized_plan=?,version=version+1 where id=?",
              r.get("plan_snapshot"),
              task);
        }
        case "DELAY_REASON" -> {
          /* Review records acknowledgment; it does not change the deadline. */
        }
        case "PROGRESS" -> {
          Long task = ((Number) r.get("task_id")).longValue();
          require(
              Objects.equals(
                  db.queryForObject(
                      "select authorized_plan from project_tasks where id=?", String.class, task),
                  plan(id, task)),
              CONFLICT,
              "The work plan changed and must be approved again");
          require(
              db.queryForObject(
                      "select count(*) from project_evidence where request_id=?",
                      Long.class,
                      request)
                  > 0,
              CONFLICT,
              "Attach evidence before approving progress");
          require(
              db.update(
                      "update project_tasks set progress=?,version=version+1 where id=? and"
                          + " project_id=? and progress<?",
                      amount,
                      r.get("task_id"),
                      id,
                      amount)
                  == 1,
              CONFLICT,
              "Task progress changed");
          progress(id);
        }
        case "BUDGET" -> {
          require(
              amount.compareTo((BigDecimal) p.get("actual_expenditure")) >= 0,
              CONFLICT,
              "Approved budget cannot be below expenditure");
          db.update("update projects set approved_budget=? where id=?", amount, id);
        }
        case "EXPENSE" -> {
          require(
              ((BigDecimal) p.get("actual_expenditure"))
                      .add(amount)
                      .compareTo((BigDecimal) p.get("approved_budget"))
                  <= 0,
              CONFLICT,
              "Expense exceeds approved budget");
          db.update(
              "update projects set actual_expenditure=actual_expenditure+? where id=?", amount, id);
        }
        case "EXTENSION" -> {
          var oldEnd =
              p.get("revised_end_date") == null
                  ? p.get("planned_end_date")
                  : p.get("revised_end_date");
          require(
              ((java.sql.Date) r.get("requested_date")).after((java.sql.Date) oldEnd),
              CONFLICT,
              "The deadline already changed");
          db.update(
              "insert into"
                  + " project_schedule_history(project_id,previous_start,previous_end,new_start,new_end,reason,changed_by)"
                  + " values (?,?,?,?,?,?,?)",
              id,
              p.get("planned_start_date"),
              oldEnd,
              p.get("planned_start_date"),
              r.get("requested_date"),
              r.get("reason"),
              actor.user().id);
          db.update(
              "update projects set revised_end_date=? where id=?", r.get("requested_date"), id);
        }
        case "COMPLETION" -> {
          matchedResources(id);
          require(
              "PENDING_APPROVAL".equals(p.get("status")),
              CONFLICT,
              "Project is not awaiting completion");
          require(
              db.queryForObject(
                      "select count(*) from project_evidence where request_id=? and media_type in"
                          + " ('image/png','image/jpeg')",
                      Long.class,
                      request)
                  > 0,
              CONFLICT,
              "Attach a completion photo (PNG or JPEG) first");
          db.update(
              "update projects set status='COMPLETED',actual_end_date=?,progress=100 where id=?",
              LocalDate.now(clock),
              id);
        }
        default -> throw new IllegalStateException();
      }
    if (!input.approve() && kind.equals("COMPLETION"))
      db.update("update projects set status='IN_PROGRESS' where id=?", id);
    db.update(
        "update project_requests set"
            + " state=?,reviewed_by=?,reviewed_at=current_timestamp,review_note=? where id=?",
        input.approve() ? "APPROVED" : "REJECTED",
        actor.user().id,
        input.note().trim(),
        request);
    notify(
        ((Number) r.get("submitted_by")).longValue(),
        id,
        kind + " request " + (input.approve() ? "approved" : "rejected"));
    changed(id, "REQUEST_REVIEWED");
  }

  @Transactional
  public void upload(Long id, Long request, String name, byte[] bytes) {
    project(id, true);
    var rows =
        db.queryForList(
            "select * from project_requests where id=? and project_id=? for update", request, id);
    require(!rows.isEmpty(), NOT_FOUND, "Request not found");
    var r = rows.getFirst();
    require(
        "PENDING".equals(r.get("state"))
            && ((Number) r.get("submitted_by")).longValue() == actor.user().id,
        FORBIDDEN,
        "Only the submitter can attach evidence to a pending request");
    require(
        bytes.length > 0 && bytes.length <= 5242880,
        BAD_REQUEST,
        "Evidence must be between 1 byte and 5 MB");
    require(
        db.queryForObject(
                "select count(*) from project_evidence where request_id=?", Long.class, request)
            < 10,
        CONFLICT,
        "Maximum ten files per request");
    String type =
        bytes.length >= 5
                && bytes[0] == '%'
                && bytes[1] == 'P'
                && bytes[2] == 'D'
                && bytes[3] == 'F'
                && bytes[4] == '-'
            ? "application/pdf"
            : bytes.length >= 8
                    && bytes[0] == (byte) 137
                    && bytes[1] == 80
                    && bytes[2] == 78
                    && bytes[3] == 71
                    && bytes[4] == 13
                    && bytes[5] == 10
                    && bytes[6] == 26
                    && bytes[7] == 10
                ? "image/png"
                : bytes.length >= 3
                        && bytes[0] == (byte) 255
                        && bytes[1] == (byte) 216
                        && bytes[2] == (byte) 255
                    ? "image/jpeg"
                    : null;
    require(type != null, BAD_REQUEST, "Upload a PDF, PNG, or JPEG file");
    String safe = (name == null ? "evidence" : name).replaceAll("[^a-zA-Z0-9._ -]", "_");
    if (safe.length() > 240) safe = safe.substring(safe.length() - 240);
    db.update(
        "insert into project_evidence(request_id,name,media_type,content,uploaded_by) values"
            + " (?,?,?,?,?)",
        request,
        safe,
        type,
        bytes,
        actor.user().id);
    changed(id, "EVIDENCE_UPLOADED");
  }

  public Map<String, Object> download(Long id, Long evidence) {
    project(id, false);
    var rows =
        db.queryForList(
            "select e.* from project_evidence e join project_requests r on r.id=e.request_id where"
                + " e.id=? and r.project_id=?",
            evidence,
            id);
    require(!rows.isEmpty(), NOT_FOUND, "Evidence not found");
    return rows.getFirst();
  }

  public List<Map<String, Object>> notifications() {
    return db.queryForList(
        "select * from notifications where user_id=? order by id desc limit 100", actor.user().id);
  }

  @Transactional
  public void read(Long id) {
    require(
        db.update(
                "update notifications set read_at=current_timestamp where id=? and user_id=?",
                id,
                actor.user().id)
            == 1,
        NOT_FOUND,
        "Notification not found");
  }
}
