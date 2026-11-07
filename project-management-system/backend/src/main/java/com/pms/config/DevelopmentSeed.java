package com.pms.config;

import com.pms.audit.AuditService;
import com.pms.users.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("dev")
@org.springframework.core.annotation.Order(10)
public class DevelopmentSeed implements CommandLineRunner {
  private final UserRepository users;
  private final PasswordEncoder encoder;
  private final Environment env;
  private final AuditService audit;

  public DevelopmentSeed(
      UserRepository users, PasswordEncoder encoder, Environment env, AuditService audit) {
    this.users = users;
    this.encoder = encoder;
    this.env = env;
    this.audit = audit;
  }

  @Transactional
  public void run(String... args) {
    seed("ADMIN", "SUPER_ADMIN", "Development Administrator", "DEV-001");
    seed("ENGINEER", "ENGINEER", "Development Engineer", "DEV-002");
  }

  private void seed(String key, String role, String name, String code) {
    String email = env.getProperty("PMS_SEED_" + key + "_EMAIL"),
        password = env.getProperty("PMS_SEED_" + key + "_PASSWORD");
    if (email == null || password == null) return;
    email = email.toLowerCase(java.util.Locale.ROOT);
    if (users.findByEmail(email).isPresent()) return;
    if (password.length() < 12 || password.length() > 64)
      throw new IllegalStateException("Seed passwords must contain 12–64 characters");
    var u = new AppUser();
    u.employeeCode = code;
    u.email = email;
    u.fullName = name;
    u.passwordHash = encoder.encode(password);
    u.roles.add(role);
    users.saveAndFlush(u);
    audit.record(u.id, "DEVELOPMENT_ACCOUNT_CREATED");
  }
}
