package com.pms.execution;

import static com.pms.execution.ExecutionService.*;

import jakarta.validation.Valid;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class ExecutionController {
  private final ExecutionService service;
  private final ProjectReports reports;

  public ExecutionController(ExecutionService service, ProjectReports reports) {
    this.service = service;
    this.reports = reports;
  }

  @GetMapping("/projects/{id}/report.xlsx")
  public ResponseEntity<byte[]> excel(
      @PathVariable Long id, @RequestParam(required = false) Long taskId) throws IOException {
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=project-" + id + ".xlsx")
        .header(HttpHeaders.CACHE_CONTROL, "no-store")
        .contentType(
            MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
        .body(reports.excel(id, taskId));
  }

  @GetMapping("/projects/{id}/report.pdf")
  public ResponseEntity<byte[]> pdf(
      @PathVariable Long id, @RequestParam(required = false) Long taskId) throws IOException {
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=project-" + id + ".pdf")
        .header(HttpHeaders.CACHE_CONTROL, "no-store")
        .contentType(MediaType.APPLICATION_PDF)
        .body(reports.pdf(id, taskId));
  }

  // Preserve exact quantities and monetary values in browser JSON.
  private Object json(Object value) {
    if (value instanceof BigDecimal n) return n.toPlainString();
    if (value instanceof java.sql.Date date) return date.toLocalDate().toString();
    if (value instanceof java.sql.Timestamp timestamp) return timestamp.toInstant().toString();
    if (value instanceof Map<?, ?> m) {
      var out = new LinkedHashMap<String, Object>();
      m.forEach((k, v) -> out.put(k.toString(), json(v)));
      return out;
    }
    if (value instanceof List<?> l) return l.stream().map(this::json).toList();
    return value;
  }

  @GetMapping("/projects/{id}/execution")
  public Object workspace(@PathVariable Long id) {
    return json(service.workspace(id));
  }

  @PostMapping("/projects/{id}/assignments")
  public void assign(@PathVariable Long id, @Valid @RequestBody Assignment input) {
    service.assign(id, input);
  }

  @DeleteMapping("/projects/{id}/assignments/{assignment}")
  public void revoke(@PathVariable Long id, @PathVariable Long assignment) {
    service.revoke(id, assignment);
  }

  @PostMapping("/projects/{id}/tasks")
  public void task(@PathVariable Long id, @Valid @RequestBody Task input) {
    service.task(id, input);
  }

  @PatchMapping("/projects/{id}/tasks/{task}/owner")
  public void transfer(
      @PathVariable Long id, @PathVariable Long task, @Valid @RequestBody Assignment input) {
    service.transfer(id, task, input);
  }

  @PostMapping("/projects/{id}/resources")
  public void resource(@PathVariable Long id, @Valid @RequestBody Resource input) {
    service.resource(id, input);
  }

  @PatchMapping("/projects/{id}/resources/{resource}")
  public void usage(
      @PathVariable Long id, @PathVariable Long resource, @Valid @RequestBody Usage input) {
    service.usage(id, resource, input);
  }

  @PostMapping("/projects/{id}/requests")
  // Work plan approval is separate from progress approval.
  public Map<String, Long> submit(@PathVariable Long id, @Valid @RequestBody Request input) {
    return Map.of("id", service.submit(id, input));
  }

  @PatchMapping("/projects/{id}/resources/{resource}/plan")
  public void reviseResource(
      @PathVariable Long id,
      @PathVariable Long resource,
      @Valid @RequestBody ResourceRevision input) {
    service.reviseResource(id, resource, input);
  }

  @PatchMapping("/projects/{id}/tasks/{task}/plan")
  public void reviseWork(
      @PathVariable Long id, @PathVariable Long task, @Valid @RequestBody WorkRevision input) {
    service.reviseWork(id, task, input);
  }

  @PostMapping("/projects/{id}/requests/{request}/review")
  public void review(
      @PathVariable Long id, @PathVariable Long request, @Valid @RequestBody Decision input) {
    service.review(id, request, input);
  }

  @PostMapping("/projects/{id}/requests/{request}/evidence")
  public void upload(
      @PathVariable Long id, @PathVariable Long request, @RequestParam MultipartFile file)
      throws IOException {
    service.upload(id, request, file.getOriginalFilename(), file.getBytes());
  }

  @GetMapping("/projects/{id}/evidence/{evidence}")
  public ResponseEntity<byte[]> download(@PathVariable Long id, @PathVariable Long evidence) {
    var file = service.download(id, evidence);
    return ResponseEntity.ok()
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.attachment().filename((String) file.get("name")).build().toString())
        .header("X-Content-Type-Options", "nosniff")
        .header(HttpHeaders.CACHE_CONTROL, "no-store")
        .contentType(MediaType.APPLICATION_OCTET_STREAM)
        .body((byte[]) file.get("content"));
  }

  @GetMapping("/notifications")
  public Object notifications() {
    return json(service.notifications());
  }

  @PatchMapping("/notifications/{id}/read")
  public void read(@PathVariable Long id) {
    service.read(id);
  }

  private String cell(Object value) {
    String s = value == null ? "" : value.toString();
    if (s.matches("(?s)^[\\s]*[=+@-].*")) s = "'" + s;
    return "\"" + s.replace("\"", "\"\"") + "\"";
  }

  @GetMapping("/projects/{id}/report.csv")
  public ResponseEntity<String> report(@PathVariable Long id) {
    var data = service.workspace(id);
    var out = new StringBuilder("\ufeffProject execution report\r\n");
    for (var section : List.of("assignments", "tasks", "resources", "requests")) {
      out.append("\r\n").append(section).append("\r\n");
      @SuppressWarnings("unchecked")
      var rows = (List<Map<String, Object>>) data.get(section);
      if (rows.isEmpty()) continue;
      out.append(String.join(",", rows.getFirst().keySet().stream().map(this::cell).toList()))
          .append("\r\n");
      for (var row : rows)
        out.append(String.join(",", row.values().stream().map(this::cell).toList())).append("\r\n");
    }
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=project-" + id + ".csv")
        .header(HttpHeaders.CACHE_CONTROL, "no-store")
        .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
        .body(out.toString());
  }
}
