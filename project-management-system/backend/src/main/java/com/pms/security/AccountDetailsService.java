package com.pms.security;

import com.pms.users.UserRepository;
import java.time.Instant;
import java.util.Locale;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;

@Service
public class AccountDetailsService implements UserDetailsService {
  private final UserRepository users;

  public AccountDetailsService(UserRepository users) {
    this.users = users;
  }

  public UserDetails loadUserByUsername(String email) {
    var u =
        users
            .findByLogin(email)
            .orElseThrow(() -> new UsernameNotFoundException("Invalid credentials"));
    return User.withUsername(u.email)
        .password(u.passwordHash)
        .roles(u.roles.toArray(String[]::new))
        .disabled(!u.active)
        .accountLocked(u.lockedUntil != null && u.lockedUntil.isAfter(Instant.now()))
        .build();
  }
}
