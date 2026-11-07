package com.pms.auth;

import com.pms.audit.AuditService;
import com.pms.users.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AccountService {
  private final UserRepository users;
  private final PasswordEncoder passwords;
  private final AuditService audit;

  public AccountService(UserRepository users, PasswordEncoder passwords, AuditService audit) {
    this.users = users;
    this.passwords = passwords;
    this.audit = audit;
  }

  @Transactional
  public void changePassword(String email, String current, String replacement) {
    var u = users.findForLogin(email).orElseThrow();
    if (!passwords.matches(current, u.passwordHash))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect");
    u.passwordHash = passwords.encode(replacement);
    u.updatedAt = java.time.Instant.now();
    audit.record(u.id, "PASSWORD_CHANGED");
  }
}
