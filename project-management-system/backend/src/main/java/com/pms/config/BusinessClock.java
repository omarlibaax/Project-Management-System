package com.pms.config;

import java.time.Clock;
import java.time.ZoneId;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;

@Configuration
public class BusinessClock {
  @Bean
  Clock clock(@Value("${pms.timezone}") String zone) {
    return Clock.system(ZoneId.of(zone));
  }
}
