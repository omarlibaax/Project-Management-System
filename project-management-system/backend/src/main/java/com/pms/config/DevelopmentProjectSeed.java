package com.pms.config;

import com.pms.audit.AuditService;
import com.pms.projects.Project;
import com.pms.projects.ProjectRepository;
import com.pms.users.UserRepository;
import java.math.BigDecimal;
import java.time.*;
import java.util.Locale;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("dev")
@Order(20)
@ConditionalOnProperty(name = "pms.seed.projects", havingValue = "true")
public class DevelopmentProjectSeed implements CommandLineRunner {
  private final ProjectRepository projects;
  private final UserRepository users;
  private final Environment env;
  private final JdbcTemplate jdbc;
  private final Clock clock;
  private final AuditService audit;

  public DevelopmentProjectSeed(
      ProjectRepository projects,
      UserRepository users,
      Environment env,
      JdbcTemplate jdbc,
      Clock clock,
      AuditService audit) {
    this.projects = projects;
    this.users = users;
    this.env = env;
    this.jdbc = jdbc;
    this.clock = clock;
    this.audit = audit;
  }

  @Transactional
  public void run(String... args) {
    jdbc.execute("select pg_advisory_xact_lock(528154)");
    if (projects.count() > 0) return;
    String email = env.getRequiredProperty("PMS_SEED_ADMIN_EMAIL").toLowerCase(Locale.ROOT);
    var manager =
        users
            .findByEmail(email)
            .filter(u -> u.active && (u.roles.contains("ADMIN") || u.roles.contains("SUPER_ADMIN")))
            .orElseThrow(
                () ->
                    new IllegalStateException(
                        "Configure an active development administrator before project seeding"));
    String[] names = {
      "Community health centre",
      "Eastern access road",
      "Water treatment upgrade",
      "Regional office renovation",
      "Pedestrian bridge"
    };
    var today = LocalDate.now(clock);
    for (int i = 0; i < 55; i++) {
      var p = new Project();
      p.code =
          "PMS-%06d"
              .formatted(jdbc.queryForObject("select nextval('project_code_seq')", Long.class));
      p.name = names[i % names.length] + " - Site " + (i + 1);
      p.description =
          "Development sample project. Replace this fixture with your organization's own project"
              + " plan.";
      p.category = i % 2 == 0 ? "Construction" : "Engineering";
      p.location = "Nairobi / Zone " + (i % 8 + 1);
      p.client = "Development Works Department";
      p.manager = manager;
      p.createdBy = manager;
      p.plannedStartDate = today.minusDays(35);
      p.plannedEndDate = today.plusDays(i % 6 == 0 ? -3 : 30 + i);
      p.originalStartDate = p.plannedStartDate;
      p.originalEndDate = p.plannedEndDate;
      p.priority = Project.Priority.values()[i % 3];
      p.status =
          switch (i % 4) {
            case 0 -> Project.Status.PLANNED;
            case 1 -> Project.Status.IN_PROGRESS;
            case 2 -> Project.Status.ON_HOLD;
            default -> Project.Status.CANCELLED;
          };
      if (p.status == Project.Status.IN_PROGRESS) p.actualStartDate = p.plannedStartDate;
      p.plannedBudget = new BigDecimal("100000.50").multiply(BigDecimal.valueOf(i + 1));
      projects.saveAndFlush(p);
      audit.record(manager.id, "DEVELOPMENT_PROJECT_CREATED:" + p.id);
    }
  }
}
