package com.pms.projects;

import org.springframework.data.jpa.repository.*;

public interface ProjectRepository
    extends JpaRepository<Project, Long>, JpaSpecificationExecutor<Project> {}
