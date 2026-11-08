package com.pms.projects;

import static com.pms.projects.Project.*;
import static com.pms.projects.ProjectDtos.*;
import static org.springframework.http.HttpStatus.*;

import com.pms.audit.AuditService;
import com.pms.common.*;
import com.pms.users.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class ProjectService {
  private final ProjectRepository projects;
  private final UserRepository users;
  private final CurrentActor actor;
  private final AuditService audit;
  private final JdbcTemplate jdbc;
  private final Clock clock;

  public ProjectService(
      ProjectRepository projects,
      UserRepository users,
      CurrentActor actor,
      AuditService audit,
      JdbcTemplate jdbc,
      Clock clock) {
    this.projects = projects;
    this.users = users;
    this.actor = actor;
    this.audit = audit;
    this.jdbc = jdbc;
    this.clock = clock;
  }

  public PageResponse<ProjectView> list(
      String search,
      Status status,
      Priority priority,
      boolean archived,
      String sort,
      String direction,
      int page,
      int size) {
    if (!Set.of("name", "createdAt", "plannedEndDate", "priority", "status", "code").contains(sort)
        || !Set.of("asc", "desc").contains(direction))
      throw new ResponseStatusException(BAD_REQUEST, "Unsupported sorting option");
    boolean managerAccess = actor.manager();
    var assigned =
        managerAccess
            ? List.<Long>of()
            : jdbc.queryForList(
                "select project_id from project_assignments where engineer_id=? and revoked_at is"
                    + " null",
                Long.class,
                actor.user().id);
    if (!managerAccess && assigned.isEmpty())
      return new PageResponse<>(List.of(), 0, page, size, 0);
    String term = UserService.escape(search.toLowerCase(Locale.ROOT).trim());
    Specification<Project> spec =
        (r, q, b) -> {
          var predicates = new ArrayList<jakarta.persistence.criteria.Predicate>();
          if (!managerAccess) predicates.add(r.get("id").in(assigned));
          predicates.add(b.equal(r.get("archived"), archived));
          if (!term.isEmpty())
            predicates.add(
                b.or(
                    b.like(b.lower(r.get("name")), "%" + term + "%", '\\'),
                    b.like(b.lower(r.get("code")), "%" + term + "%", '\\'),
                    b.like(b.lower(r.get("location")), "%" + term + "%", '\\')));
          if (status != null) predicates.add(b.equal(r.get("status"), status));
          if (priority != null) predicates.add(b.equal(r.get("priority"), priority));
          return b.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    var order = Sort.by(Sort.Direction.fromString(direction), sort).and(Sort.by("id"));
    return PageResponse.of(
        projects.findAll(spec, PageRequest.of(page, size, order)).map(this::view));
  }

  public ProjectView get(Long id) {
    return view(visible(id));
  }

  public List<ScheduleView> history(Long id) {
    visible(id);
    return jdbc.query(
        "select"
            + " h.id,h.previous_start,h.previous_end,h.new_start,h.new_end,h.reason,u.full_name,h.changed_at"
            + " from project_schedule_history h join users u on u.id=h.changed_by where"
            + " h.project_id=? order by h.changed_at desc,h.id desc",
        (r, i) ->
            new ScheduleView(
                r.getLong(1),
                r.getObject(2, LocalDate.class),
                r.getObject(3, LocalDate.class),
                r.getObject(4, LocalDate.class),
                r.getObject(5, LocalDate.class),
                r.getString(6),
                r.getString(7),
                r.getTimestamp(8).toInstant()),
        id);
  }

  @Transactional
  @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
  public ProjectView create(ProjectInput input) {
    validate(input);
    var p = new Project();
    p.code =
        "PMS-%06d".formatted(jdbc.queryForObject("select nextval('project_code_seq')", Long.class));
    p.createdBy = actor.user();
    p.originalStartDate = input.plannedStartDate();
    p.originalEndDate = input.plannedEndDate();
    apply(p, input);
    projects.saveAndFlush(p);
    audit.record(actor.user().id, "PROJECT_CREATED:" + p.id);
    return view(p);
  }

  @Transactional
  @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
  public ProjectView update(Long id, ProjectInput input) {
    var p = visible(id);
    checkVersion(p, input.version());
    if (p.archived) throw new ResponseStatusException(CONFLICT, "Archived projects are read-only");
    if (p.status == Status.COMPLETED
        || p.status == Status.PENDING_APPROVAL
        || p.status == Status.CANCELLED)
      throw new ResponseStatusException(CONFLICT, "This project's status does not allow editing");
    validate(input);
    if (!p.plannedStartDate.equals(input.plannedStartDate())
        || !p.plannedEndDate.equals(input.plannedEndDate())) {
      if (input.scheduleChangeReason() == null || input.scheduleChangeReason().isBlank())
        throw new ResponseStatusException(BAD_REQUEST, "Explain why the schedule is changing");
      jdbc.update(
          "insert into"
              + " project_schedule_history(project_id,previous_start,previous_end,new_start,new_end,reason,changed_by)"
              + " values (?,?,?,?,?,?,?)",
          id,
          p.plannedStartDate,
          p.plannedEndDate,
          input.plannedStartDate(),
          input.plannedEndDate(),
          input.scheduleChangeReason().trim(),
          actor.user().id);
      p.revisedEndDate = null;
    }
    apply(p, input);
    p.updatedAt = Instant.now();
    projects.saveAndFlush(p);
    audit.record(actor.user().id, "PROJECT_UPDATED:" + p.id);
    return view(p);
  }

  @Transactional
  @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
  public ProjectView archive(Long id, ArchiveInput input) {
    var p = visible(id);
    checkVersion(p, input.version());
    p.archived = true;
    p.updatedAt = Instant.now();
    projects.saveAndFlush(p);
    audit.record(actor.user().id, "PROJECT_ARCHIVED:" + id);
    return view(p);
  }

  private Project visible(Long id) {
    if (!actor.manager()
        && !Boolean.TRUE.equals(
            jdbc.queryForObject(
                "select exists(select 1 from project_assignments where project_id=? and"
                    + " engineer_id=? and revoked_at is null)",
                Boolean.class,
                id,
                actor.user().id)))
      throw new ResponseStatusException(NOT_FOUND, "Project not found");
    return projects
        .findById(id)
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Project not found"));
  }

  private void validate(ProjectInput input) {
    if (input.plannedEndDate().isBefore(input.plannedStartDate()))
      throw new ResponseStatusException(
          BAD_REQUEST, "Planned end date must be on or after the start date");
    if (input.status() == Status.COMPLETED || input.status() == Status.PENDING_APPROVAL)
      throw new ResponseStatusException(
          CONFLICT, "Completion and pending approval require an approval workflow");
  }

  private void apply(Project p, ProjectInput input) {
    var manager =
        users
            .findById(input.managerId())
            .filter(u -> u.active && (u.roles.contains("ADMIN") || u.roles.contains("SUPER_ADMIN")))
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        BAD_REQUEST, "Select an active administrator as project manager"));
    if (p.status != null && p.status != Status.PLANNED && input.status() == Status.PLANNED)
      throw new ResponseStatusException(CONFLICT, "A started project cannot return to planned");
    p.name = input.name().trim();
    p.description = input.description().trim();
    p.category = input.category().trim();
    p.location = input.location().trim();
    p.client = input.client().trim();
    p.manager = manager;
    p.plannedStartDate = input.plannedStartDate();
    p.plannedEndDate = input.plannedEndDate();
    p.priority = input.priority();
    p.status = input.status();
    p.plannedBudget = input.plannedBudget();
    if (p.status == Status.IN_PROGRESS && p.actualStartDate == null)
      p.actualStartDate = LocalDate.now(clock);
  }

  private void checkVersion(Project p, Long version) {
    if (version == null || p.version != version)
      throw new ResponseStatusException(CONFLICT, "This project changed. Reload before saving.");
  }

  public ScheduleCondition condition(Project p) {
    if (p.status == Status.COMPLETED) {
      var deadline = p.revisedEndDate == null ? p.plannedEndDate : p.revisedEndDate;
      if (p.actualEndDate != null && p.actualEndDate.isAfter(deadline))
        return ScheduleCondition.DELAYED;
      return p.actualEndDate != null && p.actualEndDate.isBefore(deadline)
          ? ScheduleCondition.AHEAD_OF_SCHEDULE
          : ScheduleCondition.ON_SCHEDULE;
    }
    if (p.status == Status.CANCELLED) return ScheduleCondition.ON_SCHEDULE;
    var deadline = p.revisedEndDate == null ? p.plannedEndDate : p.revisedEndDate;
    var today = LocalDate.now(clock);
    if (today.isAfter(deadline)) return ScheduleCondition.DELAYED;
    if (today.isBefore(p.plannedStartDate)) return ScheduleCondition.ON_SCHEDULE;
    long duration = ChronoUnit.DAYS.between(p.plannedStartDate, deadline) + 1;
    double expected =
        Math.min(100, 100.0 * (ChronoUnit.DAYS.between(p.plannedStartDate, today) + 1) / duration);
    if (p.progress.doubleValue() > expected + 5) return ScheduleCondition.AHEAD_OF_SCHEDULE;
    if (p.progress.doubleValue() < expected - 10) return ScheduleCondition.AT_RISK;
    return ScheduleCondition.ON_SCHEDULE;
  }

  private ProjectView view(Project p) {
    return new ProjectView(
        p.id,
        p.code,
        p.name,
        p.description,
        p.category,
        p.location,
        p.client,
        p.manager.id,
        p.manager.fullName,
        p.plannedStartDate,
        p.plannedEndDate,
        p.originalStartDate,
        p.originalEndDate,
        ChronoUnit.DAYS.between(p.plannedStartDate, p.plannedEndDate) + 1,
        p.actualStartDate,
        p.actualEndDate,
        p.revisedEndDate,
        p.priority,
        p.status,
        condition(p),
        p.plannedBudget,
        p.approvedBudget,
        p.actualExpenditure,
        p.progress,
        p.archived,
        p.createdBy.fullName,
        p.createdAt,
        p.updatedAt,
        p.version);
  }
}
