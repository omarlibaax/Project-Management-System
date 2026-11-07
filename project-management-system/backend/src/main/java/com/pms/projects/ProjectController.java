package com.pms.projects;

import static com.pms.projects.Project.*;
import static com.pms.projects.ProjectDtos.*;

import com.pms.common.PageResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects")
@Validated
public class ProjectController {
  private final ProjectService service;

  public ProjectController(ProjectService service) {
    this.service = service;
  }

  @GetMapping
  public PageResponse<ProjectView> list(
      @RequestParam(defaultValue = "") @Size(max = 180) String search,
      @RequestParam(required = false) Status status,
      @RequestParam(required = false) Priority priority,
      @RequestParam(defaultValue = "false") boolean archived,
      @RequestParam(defaultValue = "createdAt") String sort,
      @RequestParam(defaultValue = "desc") String direction,
      @RequestParam(defaultValue = "0") @Min(0) int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
    return service.list(search, status, priority, archived, sort, direction, page, size);
  }

  @GetMapping("/{id}")
  public ProjectView get(@PathVariable Long id) {
    return service.get(id);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ProjectView create(@Valid @RequestBody ProjectInput input) {
    return service.create(input);
  }

  @PutMapping("/{id}")
  public ProjectView update(@PathVariable Long id, @Valid @RequestBody ProjectInput input) {
    return service.update(id, input);
  }

  @PatchMapping("/{id}/archive")
  public ProjectView archive(@PathVariable Long id, @Valid @RequestBody ArchiveInput input) {
    return service.archive(id, input);
  }

  @GetMapping("/{id}/schedule-history")
  public List<ScheduleView> history(@PathVariable Long id) {
    return service.history(id);
  }
}
