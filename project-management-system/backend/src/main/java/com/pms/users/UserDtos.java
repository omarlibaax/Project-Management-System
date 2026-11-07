package com.pms.users;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.Set;

public final class UserDtos {
  private UserDtos() {}

  public record UserView(
      Long id,
      String employeeCode,
      String fullName,
      String email,
      String phone,
      String department,
      Long departmentId,
      String position,
      Set<String> roles,
      boolean active,
      Instant createdAt,
      Instant updatedAt,
      Instant lastLogin,
      long version) {}

  public record CreateUser(
      @NotBlank @Size(max = 40) String employeeCode,
      @NotBlank @Size(max = 160) String fullName,
      @NotBlank @Email @Size(max = 254) String email,
      @Size(max = 40) String phone,
      Long departmentId,
      @Size(max = 120) String position,
      @NotEmpty Set<@Pattern(regexp = "SUPER_ADMIN|ADMIN|ENGINEER") String> roles,
      @NotBlank @Size(min = 12, max = 64) String password) {}

  public record UpdateUser(
      @NotBlank @Size(max = 160) String fullName,
      @Size(max = 40) String phone,
      Long departmentId,
      @Size(max = 120) String position,
      @NotEmpty Set<@Pattern(regexp = "SUPER_ADMIN|ADMIN|ENGINEER") String> roles,
      @NotNull @PositiveOrZero Long version) {}

  public record AccountStatus(boolean active, @NotNull @PositiveOrZero Long version) {}

  public record DepartmentView(Long id, String name) {}

  public record NewDepartment(@NotBlank @Size(max = 120) String name) {}
}
