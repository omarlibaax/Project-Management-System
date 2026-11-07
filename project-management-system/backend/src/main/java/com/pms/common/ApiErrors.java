package com.pms.common;

import java.util.Map;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiErrors {
  @ExceptionHandler({
    jakarta.validation.ConstraintViolationException.class,
    org.springframework.web.method.annotation.HandlerMethodValidationException.class,
    org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class,
    org.springframework.http.converter.HttpMessageNotReadableException.class
  })
  ResponseEntity<?> invalidInput(Exception ex) {
    return ResponseEntity.badRequest()
        .body(Map.of("message", "Invalid request. Check values, dates and paging options."));
  }

  @ExceptionHandler({
    org.springframework.dao.DataIntegrityViolationException.class,
    org.springframework.dao.OptimisticLockingFailureException.class
  })
  ResponseEntity<?> conflict(Exception ex) {
    return ResponseEntity.status(HttpStatus.CONFLICT)
        .body(
            Map.of(
                "message",
                "This record changed or conflicts with an existing record. Reload and check unique"
                    + " values."));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<?> validation(MethodArgumentNotValidException ex) {
    return ResponseEntity.badRequest()
        .body(
            Map.of(
                "message",
                "Check the submitted fields",
                "fields",
                ex.getBindingResult().getFieldErrors().stream()
                    .map(
                        e ->
                            Map.of(
                                "field",
                                e.getField(),
                                "message",
                                String.valueOf(e.getDefaultMessage())))
                    .toList()));
  }

  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<?> status(ResponseStatusException ex) {
    return ResponseEntity.status(ex.getStatusCode())
        .body(Map.of("message", ex.getReason() == null ? "Request rejected" : ex.getReason()));
  }
}
