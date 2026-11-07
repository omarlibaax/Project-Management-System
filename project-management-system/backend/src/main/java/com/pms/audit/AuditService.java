package com.pms.audit;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class AuditService {
  private final JdbcTemplate jdbc;

  public AuditService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public void record(Long actor, String action) {
    jdbc.update("insert into audit_logs(actor_id,action) values (?,?)", actor, action);
  }
}
