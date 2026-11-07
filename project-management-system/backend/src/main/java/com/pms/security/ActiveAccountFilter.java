package com.pms.security;

import com.pms.users.UserRepository;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

public class ActiveAccountFilter extends OncePerRequestFilter {
  private final UserRepository users;

  public ActiveAccountFilter(UserRepository users) {
    this.users = users;
  }

  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    var auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) {
      var user = users.findByEmail(auth.getName());
      var roles =
          auth.getAuthorities().stream()
              .map(a -> a.getAuthority())
              .filter(a -> a.startsWith("ROLE_"))
              .map(a -> a.substring(5))
              .collect(java.util.stream.Collectors.toSet());
      if (user.isEmpty() || !user.get().active || !user.get().roles.equals(roles)) {
        var session = request.getSession(false);
        if (session != null) session.invalidate();
        SecurityContextHolder.clearContext();
        response.setStatus(401);
        response.setContentType("application/json");
        response.getWriter().write("{\"message\":\"Session expired. Please sign in again.\"}");
        return;
      }
    }
    chain.doFilter(request, response);
  }
}
