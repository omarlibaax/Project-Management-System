package com.pms.projects;

import com.pms.users.AppUser;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;

@Entity
@Table(name = "projects")
public class Project {
  public enum Priority {
    LOW,
    MEDIUM,
    HIGH
  }

  public enum Status {
    PLANNED,
    IN_PROGRESS,
    ON_HOLD,
    PENDING_APPROVAL,
    COMPLETED,
    CANCELLED
  }

  public enum ScheduleCondition {
    ON_SCHEDULE,
    AHEAD_OF_SCHEDULE,
    AT_RISK,
    DELAYED
  }

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  public String code;
  public String name;
  public String description = "";
  public String category;
  public String location;
  public String client;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "manager_id")
  public AppUser manager;

  public LocalDate plannedStartDate;
  public LocalDate plannedEndDate;
  public LocalDate originalStartDate;
  public LocalDate originalEndDate;
  public LocalDate actualStartDate;
  public LocalDate actualEndDate;
  public LocalDate revisedEndDate;

  @Enumerated(EnumType.STRING)
  public Priority priority;

  @Enumerated(EnumType.STRING)
  public Status status;

  public BigDecimal plannedBudget = BigDecimal.ZERO;
  public BigDecimal approvedBudget = BigDecimal.ZERO;
  public BigDecimal actualExpenditure = BigDecimal.ZERO;
  public BigDecimal progress = BigDecimal.ZERO;
  public boolean archived;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "created_by")
  public AppUser createdBy;

  public Instant createdAt = Instant.now();
  public Instant updatedAt = Instant.now();
  @Version public long version;
}
