package com.pms.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/** SPA navigation shares the API origin in the packaged application. */
@Controller
public class FrontendController {
  @GetMapping({
    "/projects",
    "/projects/new",
    "/projects/{id:[0-9]+}",
    "/projects/{id:[0-9]+}/edit",
    "/users",
    "/engineers",
    "/profile",
    "/notifications"
  })
  public String frontend() {
    return "forward:/index.html";
  }
}
