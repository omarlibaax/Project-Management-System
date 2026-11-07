package com.pms.users;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "users")
public class AppUser {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(nullable = false, unique = true)
  public String employeeCode;

  @Column(nullable = false)
  public String fullName;

  @Column(nullable = false, unique = true)
  public String email;

  @Column(nullable = false)
  public String passwordHash;

  public String phone;
  public String position;
  public Long departmentId;
  @Version public long version;

  public boolean active = true;
  public int failedAttempts;
  public Instant lockedUntil;
  public Instant lastLogin;
  public Instant createdAt = Instant.now();
  public Instant updatedAt = Instant.now();

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "user_roles", joinColumns = @JoinColumn(name = "user_id"))
  @Column(name = "role_name")
  public Set<String> roles = new HashSet<>();
}
