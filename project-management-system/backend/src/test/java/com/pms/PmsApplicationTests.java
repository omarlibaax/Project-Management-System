package com.pms;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.pms.users.*;
import java.util.UUID;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class PmsApplicationTests {
  @Autowired MockMvc mvc;
  @Autowired UserRepository users;
  @Autowired PasswordEncoder encoder;
  private String email;
  private final String password = "Integration-only-password-21";

  @BeforeEach
  void createAccount() {
    email = UUID.randomUUID() + "@example.test";
    var u = new AppUser();
    u.employeeCode = UUID.randomUUID().toString();
    u.fullName = "Integration Engineer";
    u.email = email;
    u.passwordHash = encoder.encode(password);
    u.roles.add("ENGINEER");
    users.saveAndFlush(u);
  }

  private MockHttpSession signIn() throws Exception {
    return (MockHttpSession)
        mvc.perform(
                post("/api/auth/login")
                    .with(csrf())
                    .param("email", email)
                    .param("password", password))
            .andExpect(status().isNoContent())
            .andReturn()
            .getRequest()
            .getSession(false);
  }

  @Test
  void healthAndUnauthorizedAccess() throws Exception {
    mvc.perform(get("/actuator/health")).andExpect(status().isOk());
    mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
  }

  @Test
  void employeeCodeLoginUsesCanonicalEmailAndLockout() throws Exception {
    var account = users.findByEmail(email).orElseThrow();
    String username = account.employeeCode;
    var session = (MockHttpSession) mvc.perform(post("/api/auth/login").with(csrf())
        .param("email", username).param("password", password))
        .andExpect(status().isNoContent()).andReturn().getRequest().getSession(false);
    mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk())
        .andExpect(jsonPath("$.email").value(email));
    for (int attempt = 0; attempt < 5; attempt++)
      mvc.perform(post("/api/auth/login").with(csrf()).param("email", username)
          .param("password", "wrong")).andExpect(status().isUnauthorized());
    mvc.perform(post("/api/auth/login").with(csrf()).param("email", username)
        .param("password", password)).andExpect(status().isUnauthorized());
  }

  @Test
  void csrfRequiredForLogin() throws Exception {
    mvc.perform(post("/api/auth/login").param("email", email).param("password", password))
        .andExpect(status().isForbidden());
  }

  @Test
  void authenticatedProfileAndAdminRestriction() throws Exception {
    var session = signIn();
    mvc.perform(get("/api/auth/me").session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.email").value(email))
        .andExpect(jsonPath("$.passwordHash").doesNotExist());
    mvc.perform(get("/api/admin/access-check").session(session)).andExpect(status().isForbidden());
  }

  @Test
  void managerCanAccessAdminEndpoint() throws Exception {
    var u = users.findByEmail(email).orElseThrow();
    u.roles.clear();
    u.roles.add("ADMIN");
    users.saveAndFlush(u);
    mvc.perform(get("/api/admin/access-check").session(signIn())).andExpect(status().isOk());
  }

  @Test
  void suspensionRevokesExistingSession() throws Exception {
    var session = signIn();
    var u = users.findByEmail(email).orElseThrow();
    u.active = false;
    users.saveAndFlush(u);
    mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isUnauthorized());
    mvc.perform(
            post("/api/auth/login").with(csrf()).param("email", email).param("password", password))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void repeatedFailuresLockAccount() throws Exception {
    for (int i = 0; i < 5; i++)
      mvc.perform(
              post("/api/auth/login").with(csrf()).param("email", email).param("password", "wrong"))
          .andExpect(status().isUnauthorized());
    mvc.perform(
            post("/api/auth/login").with(csrf()).param("email", email).param("password", password))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void logoutInvalidatesSession() throws Exception {
    var session = signIn();
    mvc.perform(post("/api/auth/logout").session(session).with(csrf()))
        .andExpect(status().isNoContent());
    mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
  }

  @Test
  void changePasswordRequiresCurrentPassword() throws Exception {
    mvc.perform(
            post("/api/auth/password")
                .session(signIn())
                .with(csrf())
                .contentType("application/json")
                .content(
                    "{\"currentPassword\":\"wrong\",\"newPassword\":\"replacement-password-21\"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void passwordChangeInvalidatesSessionAndOldPassword() throws Exception {
    mvc.perform(
            post("/api/auth/password")
                .session(signIn())
                .with(csrf())
                .contentType("application/json")
                .content(
                    "{\"currentPassword\":\""
                        + password
                        + "\",\"newPassword\":\"replacement-password-21\"}"))
        .andExpect(status().isOk());
    mvc.perform(
            post("/api/auth/login").with(csrf()).param("email", email).param("password", password))
        .andExpect(status().isUnauthorized());
    mvc.perform(
            post("/api/auth/login")
                .with(csrf())
                .param("email", email)
                .param("password", "replacement-password-21"))
        .andExpect(status().isNoContent());
  }
}
