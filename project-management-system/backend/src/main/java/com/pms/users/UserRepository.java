package com.pms.users;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;

public interface UserRepository
    extends JpaRepository<AppUser, Long>, JpaSpecificationExecutor<AppUser> {
  Optional<AppUser> findByEmail(String email);

  boolean existsByEmailIgnoreCase(String email);

  boolean existsByEmployeeCode(String employeeCode);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select u from AppUser u where u.email = :email")
  Optional<AppUser> findForLogin(String email);
}
