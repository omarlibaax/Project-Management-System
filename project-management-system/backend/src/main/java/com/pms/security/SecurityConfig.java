package com.pms.security;

import com.pms.auth.LoginAttemptService;
import com.pms.users.UserRepository;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.*;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {
  @Bean
  PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12);
  }

  @Bean
  SecurityFilterChain filterChain(
      HttpSecurity http, UserRepository users, LoginAttemptService attempts) throws Exception {
    return http.csrf(
            c ->
                c.csrfTokenRepository(new HttpSessionCsrfTokenRepository())
                    .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
        .authorizeHttpRequests(
            a ->
                a.requestMatchers("/api/auth/csrf", "/api/auth/login", "/actuator/health")
                    .permitAll()
                    .requestMatchers("/api/admin/**")
                    .hasAnyRole("ADMIN", "SUPER_ADMIN")
                    .anyRequest()
                    .authenticated())
        .requestCache(c -> c.disable())
        .exceptionHandling(
            e ->
                e.authenticationEntryPoint(
                        (req, res, ex) -> {
                          res.setStatus(401);
                          res.setContentType("application/json");
                          res.getWriter().write("{\"message\":\"Sign in to continue\"}");
                        })
                    .accessDeniedHandler(
                        (req, res, ex) -> {
                          res.setStatus(403);
                          res.setContentType("application/json");
                          res.getWriter()
                              .write("{\"message\":\"Permission denied or invalid CSRF token\"}");
                        }))
        .formLogin(
            f ->
                f.loginProcessingUrl("/api/auth/login")
                    .usernameParameter("email")
                    .successHandler(
                        (req, res, auth) -> {
                          attempts.success(auth.getName());
                          res.setStatus(204);
                        })
                    .failureHandler(
                        (req, res, ex) -> {
                          attempts.failure(req.getParameter("email"));
                          res.setStatus(401);
                          res.setContentType("application/json");
                          res.getWriter()
                              .write(
                                  "{\"message\":\"Invalid credentials or account unavailable\"}");
                        }))
        .logout(
            l ->
                l.logoutUrl("/api/auth/logout")
                    .deleteCookies("JSESSIONID")
                    .logoutSuccessHandler((req, res, auth) -> res.setStatus(204)))
        .addFilterBefore(new ActiveAccountFilter(users), UsernamePasswordAuthenticationFilter.class)
        .build();
  }
}
