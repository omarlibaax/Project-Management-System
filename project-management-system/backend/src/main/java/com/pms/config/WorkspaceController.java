package com.pms.config;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

@RestController
public class WorkspaceController {
  @GetMapping("/api/workspace")
  public Map<String, String> workspace(
      @Value("${pms.timezone}") String zone, @Value("${pms.currency}") String currency) {
    return Map.of("timezone", zone, "currency", currency, "phase", "Users and projects");
  }

  @GetMapping("/api/admin/access-check")
  public Map<String, String> admin() {
    return Map.of("access", "granted");
  }
}
