package com.pms.users;

import static com.pms.users.UserDtos.*;
import static org.springframework.http.HttpStatus.*;

import com.pms.audit.AuditService;
import com.pms.common.*;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class UserService {
  private final UserRepository users;
  private final JdbcTemplate jdbc;
  private final PasswordEncoder passwords;
  private final CurrentActor actor;
  private final AuditService audit;

  public UserService(
      UserRepository users,
      JdbcTemplate jdbc,
      PasswordEncoder passwords,
      CurrentActor actor,
      AuditService audit) {
    this.users = users;
    this.jdbc = jdbc;
    this.passwords = passwords;
    this.actor = actor;
    this.audit = audit;
  }

  @PreAuthorize("hasRole('SUPER_ADMIN')")
  public PageResponse<UserView> list(
      String search, String role, Boolean active, int page, int size) {
    return search(search, role, active, page, size);
  }

  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
  public PageResponse<UserView> engineers(String search, Boolean active, int page, int size) {
    return search(search, "ENGINEER", active, page, size);
  }

  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
  public PageResponse<UserView> managers(int page, int size) {
    Specification<AppUser> spec =
        (r, q, b) ->
            b.and(
                b.isTrue(r.get("active")),
                b.or(
                    b.isMember("ADMIN", r.get("roles")),
                    b.isMember("SUPER_ADMIN", r.get("roles"))));
    return PageResponse.of(
        users.findAll(spec, PageRequest.of(page, size, Sort.by("fullName"))).map(this::view));
  }

  private PageResponse<UserView> search(
      String search, String role, Boolean active, int page, int size) {
    if (role != null && !Set.of("ADMIN", "SUPER_ADMIN", "ENGINEER").contains(role))
      throw new ResponseStatusException(BAD_REQUEST, "Unknown role");
    String term = search.toLowerCase(Locale.ROOT).trim();
    Specification<AppUser> spec =
        (r, q, b) -> {
          var predicates = new ArrayList<jakarta.persistence.criteria.Predicate>();
          if (!term.isEmpty())
            predicates.add(
                b.or(
                    b.like(b.lower(r.get("fullName")), "%" + escape(term) + "%", '\\'),
                    b.like(b.lower(r.get("email")), "%" + escape(term) + "%", '\\'),
                    b.like(b.lower(r.get("employeeCode")), "%" + escape(term) + "%", '\\')));
          if (role != null) predicates.add(b.isMember(role, r.get("roles")));
          if (active != null) predicates.add(b.equal(r.get("active"), active));
          return b.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    return PageResponse.of(
        users
            .findAll(spec, PageRequest.of(page, size, Sort.by("fullName").and(Sort.by("id"))))
            .map(this::view));
  }

  public static String escape(String term) {
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
  }

  @Transactional
  @PreAuthorize("hasRole('SUPER_ADMIN')")
  public UserView create(CreateUser request) {
    String email = request.email().trim().toLowerCase(Locale.ROOT),
        code = request.employeeCode().trim();
    if (users.existsByEmailIgnoreCase(email) || users.existsByEmployeeCode(code))
      throw new ResponseStatusException(CONFLICT, "Email or employee code already exists");
    checkDepartment(request.departmentId());
    var u = new AppUser();
    u.email = email;
    u.employeeCode = code;
    u.fullName = request.fullName().trim();
    u.phone = request.phone();
    u.position = request.position();
    u.departmentId = request.departmentId();
    u.roles.addAll(request.roles());
    u.passwordHash = passwords.encode(request.password());
    users.saveAndFlush(u);
    audit.record(actor.user().id, "USER_CREATED:" + u.id);
    return view(u);
  }

  @Transactional
  @PreAuthorize("hasRole('SUPER_ADMIN')")
  public UserView update(Long id, UpdateUser request) {
    var u = required(id);
    checkVersion(u, request.version());
    if (id.equals(actor.user().id) && !u.roles.equals(request.roles()))
      throw new ResponseStatusException(CONFLICT, "You cannot change your own roles");
    checkDepartment(request.departmentId());
    u.fullName = request.fullName().trim();
    u.phone = request.phone();
    u.position = request.position();
    u.departmentId = request.departmentId();
    u.roles = new HashSet<>(request.roles());
    u.updatedAt = Instant.now();
    users.saveAndFlush(u);
    audit.record(actor.user().id, "USER_UPDATED:" + id);
    return view(u);
  }

  @Transactional
  @PreAuthorize("hasRole('SUPER_ADMIN')")
  public UserView status(Long id, AccountStatus request) {
    var u = required(id);
    checkVersion(u, request.version());
    if (id.equals(actor.user().id))
      throw new ResponseStatusException(
          CONFLICT, "You cannot suspend or reactivate your own account");
    u.active = request.active();
    u.updatedAt = Instant.now();
    users.saveAndFlush(u);
    audit.record(actor.user().id, (u.active ? "USER_REACTIVATED:" : "USER_SUSPENDED:") + id);
    return view(u);
  }

  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
  public List<DepartmentView> departments() {
    return jdbc.query(
        "select id,name from departments order by name",
        (r, i) -> new DepartmentView(r.getLong(1), r.getString(2)));
  }

  @Transactional
  @PreAuthorize("hasRole('SUPER_ADMIN')")
  public DepartmentView createDepartment(NewDepartment request) {
    var id =
        jdbc.queryForObject(
            "insert into departments(name) values (?) returning id",
            Long.class,
            request.name().trim());
    audit.record(actor.user().id, "DEPARTMENT_CREATED:" + id);
    return new DepartmentView(id, request.name().trim());
  }

  private void checkDepartment(Long id) {
    if (id != null
        && !Boolean.TRUE.equals(
            jdbc.queryForObject(
                "select exists(select 1 from departments where id=?)", Boolean.class, id)))
      throw new ResponseStatusException(BAD_REQUEST, "Department does not exist");
  }

  private AppUser required(Long id) {
    return users
        .findById(id)
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "User not found"));
  }

  private void checkVersion(AppUser user, Long version) {
    if (user.version != version)
      throw new ResponseStatusException(CONFLICT, "This account changed. Reload before saving.");
  }

  private UserView view(AppUser u) {
    String department =
        u.departmentId == null
            ? null
            : jdbc.queryForObject(
                "select name from departments where id=?", String.class, u.departmentId);
    return new UserView(
        u.id,
        u.employeeCode,
        u.fullName,
        u.email,
        u.phone,
        department,
        u.departmentId,
        u.position,
        Set.copyOf(u.roles),
        u.active,
        u.createdAt,
        u.updatedAt,
        u.lastLogin,
        u.version);
  }
}
