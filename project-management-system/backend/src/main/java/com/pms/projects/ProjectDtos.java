package com.pms.projects;

import static com.pms.projects.Project.*;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.*;

public final class ProjectDtos {
  private ProjectDtos() {}

  public record ProjectInput(
      @NotBlank @Size(max = 180) String name,
      @NotNull @Size(max = 4000) String description,
      @NotBlank @Size(max = 120) String category,
      @NotBlank @Size(max = 240) String location,
      @NotBlank @Size(max = 180) String client,
      @NotNull @Positive Long managerId,
      @NotNull LocalDate plannedStartDate,
      @NotNull LocalDate plannedEndDate,
      @NotNull Priority priority,
      @NotNull Status status,
      @NotNull @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal plannedBudget,
      @Size(max = 1000) String scheduleChangeReason,
      @PositiveOrZero Long version) {}

  public record ProjectView(
      Long id,
      String code,
      String name,
      String description,
      String category,
      String location,
      String client,
      Long managerId,
      String managerName,
      LocalDate plannedStartDate,
      LocalDate plannedEndDate,
      LocalDate originalStartDate,
      LocalDate originalEndDate,
      long plannedDuration,
      LocalDate actualStartDate,
      LocalDate actualEndDate,
      LocalDate revisedEndDate,
      Priority priority,
      Status status,
      ScheduleCondition scheduleCondition,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal plannedBudget,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal approvedBudget,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal actualExpenditure,
      BigDecimal progress,
      boolean archived,
      String createdBy,
      Instant createdAt,
      Instant updatedAt,
      long version) {}

  public record ArchiveInput(@NotNull @PositiveOrZero Long version) {}

  public record ScheduleView(
      Long id,
      LocalDate previousStart,
      LocalDate previousEnd,
      LocalDate newStart,
      LocalDate newEnd,
      String reason,
      String changedBy,
      Instant changedAt) {}
}
