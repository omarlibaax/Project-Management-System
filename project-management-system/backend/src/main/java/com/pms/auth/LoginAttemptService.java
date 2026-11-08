package com.pms.auth;

import com.pms.audit.AuditService;
import com.pms.users.*;
import java.time.Instant;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LoginAttemptService {
  private final UserRepository users;
  private final AuditService audit;

  public LoginAttemptService(UserRepository users, AuditService audit) {
    this.users = users;
    this.audit = audit;
  }

  @Transactional
  public void failure(String email) {
    if (email == null || email.length() > 254) return;
    users
        .findByLogin(email)
        .flatMap(u -> users.findForLogin(u.email))
        .ifPresent(
            u -> {
              var now = Instant.now();
              if (u.lockedUntil != null && u.lockedUntil.isAfter(now)) return;
              if (u.lockedUntil != null) {
                u.failedAttempts = 0;
                u.lockedUntil = null;
              }
              u.failedAttempts++;
              if (u.failedAttempts >= 5) u.lockedUntil = now.plusSeconds(900);
              u.updatedAt = now;
              audit.record(u.id, "LOGIN_FAILED");
            });
  }

  @Transactional
  public void success(String email) {
    var u = users.findForLogin(email).orElseThrow();
    u.failedAttempts = 0;
    u.lockedUntil = null;
    u.lastLogin = Instant.now();
    u.updatedAt = u.lastLogin;
    audit.record(u.id, "LOGIN_SUCCEEDED");
  }
}
