package com.pms.projects;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {
  private final DashboardService service;
  private final String currency;

  public DashboardController(DashboardService service, @Value("${pms.currency}") String currency) {
    this.service = service;
    this.currency = currency;
  }

  @GetMapping("/admin")
  public DashboardService.Summary admin() {
    return service.admin(currency);
  }

  @GetMapping("/engineer")
  public Map<String, Object> engineer() {
    return service.engineer();
  }
}
