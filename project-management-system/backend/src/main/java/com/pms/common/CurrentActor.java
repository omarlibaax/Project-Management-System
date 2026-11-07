package com.pms.common;

import static org.springframework.http.HttpStatus.UNAUTHORIZED;

import com.pms.users.AppUser;
import com.pms.users.UserRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class CurrentActor {
  private final UserRepository users;

  public CurrentActor(UserRepository users) {
    this.users = users;
  }

  public AppUser user() {
    var auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth == null) throw new ResponseStatusException(UNAUTHORIZED, "Sign in to continue");
    return users
        .findByEmail(auth.getName())
        .filter(u -> u.active)
        .orElseThrow(() -> new ResponseStatusException(UNAUTHORIZED, "Account unavailable"));
  }

  public boolean manager() {
    var roles = user().roles;
    return roles.contains("ADMIN") || roles.contains("SUPER_ADMIN");
  }
}
