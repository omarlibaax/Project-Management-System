package com.pms.projects;

import com.pms.common.CurrentActor;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class DashboardService {
  public record Summary(
      long total,
      long planned,
      long inProgress,
      long onHold,
      long pendingApproval,
      long completed,
      long cancelled,
      long delayed,
      long highPriority,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal plannedBudget,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal actualExpenditure,
      String currency,
      Map<String, Long> byStatus) {}

  private final JdbcTemplate jdbc;
  private final Clock clock;
  private final CurrentActor actor;

  public DashboardService(JdbcTemplate jdbc, Clock clock, CurrentActor actor) {
    this.jdbc = jdbc;
    this.clock = clock;
    this.actor = actor;
  }

  @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
  public Summary admin(String currency) {
    return jdbc.queryForObject(
        """
        select count(*) total,
        count(*) filter(where status='PLANNED') planned,
        count(*) filter(where status='IN_PROGRESS') in_progress,
        count(*) filter(where status='ON_HOLD') on_hold,
        count(*) filter(where status='PENDING_APPROVAL') pending_approval,
        count(*) filter(where status='COMPLETED') completed,
        count(*) filter(where status='CANCELLED') cancelled,
        count(*) filter(where status not in ('COMPLETED','CANCELLED') and coalesce(revised_end_date,planned_end_date) < ?) delayed,
        count(*) filter(where priority='HIGH') high_priority,
        coalesce(sum(planned_budget),0) planned_budget, coalesce(sum(actual_expenditure),0) actual_expenditure
        from projects where not archived
        """,
        (r, i) -> {
          var counts = new LinkedHashMap<String, Long>();
          for (var s : Project.Status.values())
            counts.put(s.name(), r.getLong(s.name().toLowerCase(Locale.ROOT)));
          return new Summary(
              r.getLong("total"),
              r.getLong("planned"),
              r.getLong("in_progress"),
              r.getLong("on_hold"),
              r.getLong("pending_approval"),
              r.getLong("completed"),
              r.getLong("cancelled"),
              r.getLong("delayed"),
              r.getLong("high_priority"),
              r.getBigDecimal("planned_budget"),
              r.getBigDecimal("actual_expenditure"),
              currency,
              counts);
        },
        LocalDate.now(clock));
  }

  public Map<String, Object> engineer() {
    Long id = actor.user().id;
    return Map.of(
        "assignmentManagementAvailable",
        true,
        "assignedProjects",
        jdbc.queryForObject(
            "select count(*) from project_assignments a join projects p on p.id=a.project_id where"
                + " a.engineer_id=? and a.revoked_at is null and not p.archived",
            Long.class,
            id),
        "unfinishedTasks",
        jdbc.queryForObject(
            "select count(*) from project_tasks t join project_assignments a on"
                + " a.project_id=t.project_id and a.engineer_id=t.engineer_id and a.revoked_at is"
                + " null join projects p on p.id=t.project_id where t.engineer_id=? and"
                + " t.progress<100 and not p.archived and p.status not in"
                + " ('COMPLETED','CANCELLED')",
            Long.class,
            id));
  }
}
