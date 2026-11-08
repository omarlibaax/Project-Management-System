package com.pms.execution;

import java.time.*;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DelayMonitor {
  @Configuration
  @EnableScheduling
  static class Scheduling {}

  private final JdbcTemplate db;
  private final Clock clock;

  public DelayMonitor(JdbcTemplate db, Clock clock) {
    this.db = db;
    this.clock = clock;
  }

  @Scheduled(
      fixedDelayString = "${pms.delay-check-ms:3600000}",
      initialDelayString = "${pms.delay-check-ms:3600000}")
  @Transactional
  public void scan() {
    db.update(
        "insert into notifications(user_id,project_id,message,dedup_key) select"
            + " manager_id,id,'Project is overdue. Review progress and request an extension if"
            + " needed.','delay:'||id||':'||coalesce(revised_end_date,planned_end_date) from"
            + " projects where not archived and status not in ('COMPLETED','CANCELLED') and"
            + " coalesce(revised_end_date,planned_end_date)<? on conflict(dedup_key) do nothing",
        LocalDate.now(clock));
    db.update(
        "insert into notifications(user_id,project_id,message,dedup_key) select"
            + " a.engineer_id,p.id,'Project is overdue. Submit an explanation with an extension"
            + " request.','delay:'||p.id||':'||a.engineer_id||':'||coalesce(p.revised_end_date,p.planned_end_date)"
            + " from projects p join project_assignments a on a.project_id=p.id and a.revoked_at is"
            + " null where not p.archived and p.status not in ('COMPLETED','CANCELLED') and"
            + " coalesce(p.revised_end_date,p.planned_end_date)<? on conflict(dedup_key) do"
            + " nothing",
        LocalDate.now(clock));
  }
}
