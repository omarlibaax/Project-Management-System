package com.pms.auth;

import com.pms.users.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final UserRepository users;
  private final AccountService accounts;

  public AuthController(UserRepository users, AccountService accounts) {
    this.users = users;
    this.accounts = accounts;
  }

  public record Profile(
      Long id, String employeeCode, String fullName, String email, Set<String> roles) {}

  public record PasswordChange(
      @NotBlank String currentPassword, @NotBlank @Size(min = 12, max = 64) String newPassword) {}

  @GetMapping("/csrf")
  public Map<String, String> csrf(CsrfToken token) {
    return Map.of("token", token.getToken(), "headerName", token.getHeaderName());
  }

  @GetMapping("/me")
  public Profile me(Authentication auth) {
    var u = users.findByEmail(auth.getName()).orElseThrow();
    return new Profile(u.id, u.employeeCode, u.fullName, u.email, Set.copyOf(u.roles));
  }

  @PostMapping("/password")
  public void password(
      Authentication auth, @Valid @RequestBody PasswordChange change, HttpServletRequest request) {
    accounts.changePassword(auth.getName(), change.currentPassword(), change.newPassword());
    request.getSession().invalidate();
  }
}
