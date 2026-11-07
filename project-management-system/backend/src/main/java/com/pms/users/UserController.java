package com.pms.users;

import static com.pms.users.UserDtos.*;

import com.pms.common.PageResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@Validated
public class UserController {
  private final UserService service;

  public UserController(UserService service) {
    this.service = service;
  }

  @GetMapping("/users")
  public PageResponse<UserView> users(
      @RequestParam(defaultValue = "") @Size(max = 160) String search,
      @RequestParam(required = false) String role,
      @RequestParam(required = false) Boolean active,
      @RequestParam(defaultValue = "0") @Min(0) int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
    return service.list(search, role, active, page, size);
  }

  @GetMapping("/engineers")
  public PageResponse<UserView> engineers(
      @RequestParam(defaultValue = "") @Size(max = 160) String search,
      @RequestParam(required = false) Boolean active,
      @RequestParam(defaultValue = "0") @Min(0) int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
    return service.engineers(search, active, page, size);
  }

  @GetMapping("/managers")
  public PageResponse<UserView> managers(
      @RequestParam(defaultValue = "0") @Min(0) int page,
      @RequestParam(defaultValue = "100") @Min(1) @Max(100) int size) {
    return service.managers(page, size);
  }

  @PostMapping("/users")
  @ResponseStatus(HttpStatus.CREATED)
  public UserView create(@Valid @RequestBody CreateUser request) {
    return service.create(request);
  }

  @PutMapping("/users/{id}")
  public UserView update(@PathVariable Long id, @Valid @RequestBody UpdateUser request) {
    return service.update(id, request);
  }

  @PatchMapping("/users/{id}/status")
  public UserView status(@PathVariable Long id, @Valid @RequestBody AccountStatus request) {
    return service.status(id, request);
  }

  @GetMapping("/departments")
  public List<DepartmentView> departments() {
    return service.departments();
  }

  @PostMapping("/departments")
  @ResponseStatus(HttpStatus.CREATED)
  public DepartmentView department(@Valid @RequestBody NewDepartment request) {
    return service.createDepartment(request);
  }
}
