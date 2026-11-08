package com.pms.execution;

import com.pms.projects.ProjectService;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.*;
import org.springframework.stereotype.Service;

/** Dependency-free exports; spreadsheet values are text to preserve exact decimal amounts. */
@Service
public class ProjectReports {
  private final ExecutionService execution;
  private final ProjectService projects;

  public ProjectReports(ExecutionService execution, ProjectService projects) {
    this.execution = execution;
    this.projects = projects;
  }

  private List<List<String>> rows(Long id, Long taskId) {
    var p = projects.get(id);
    var data = execution.workspace(id);
    var rows = new ArrayList<List<String>>();
    rows.add(List.of("Project report", p.code(), p.name()));
    rows.add(
        List.of(
            "Project start date",
            p.plannedStartDate().toString(),
            "Project end date",
            p.plannedEndDate().toString()));
    rows.add(
        List.of(
            "Duration (days)",
            Long.toString(p.plannedDuration()),
            "Schedule",
            p.scheduleCondition().name()));
    rows.add(List.of("Original budget", p.plannedBudget().toPlainString()));
    if (taskId != null) {
      @SuppressWarnings("unchecked")
      var tasks = (List<Map<String, Object>>) data.get("tasks");
      var selected =
          tasks.stream()
              .filter(t -> ((Number) t.get("id")).longValue() == taskId)
              .findFirst()
              .orElseThrow(
                  () ->
                      new org.springframework.web.server.ResponseStatusException(
                          org.springframework.http.HttpStatus.NOT_FOUND, "Work item not found"));
      rows.add(
          List.of(
              "Work item",
              selected.get("title").toString(),
              "Work start",
              selected.get("start_date").toString(),
              "Work end",
              selected.get("due_date").toString()));
      rows.add(
          List.of(
              "Work budget",
              selected.get("planned_budget").toString(),
              "Proceed decision",
              selected.get("authorized_plan") == null ? "AWAITING APPROVAL" : "APPROVED"));
    }
    @SuppressWarnings("unchecked")
    var resources = (List<Map<String, Object>>) data.get("resources");
    var scoped =
        resources.stream()
            .filter(r -> taskId == null || Objects.equals(r.get("task_id"), taskId))
            .toList();
    java.math.BigDecimal labor = java.math.BigDecimal.ZERO, materials = java.math.BigDecimal.ZERO;
    for (var resource : scoped) {
      var cost =
          ((java.math.BigDecimal) resource.get("planned"))
              .multiply((java.math.BigDecimal) resource.get("unit_cost"));
      if (resource.get("kind").equals("LABOR")) labor = labor.add(cost);
      else materials = materials.add(cost);
    }
    rows.add(
        List.of(
            "Planned labor cost",
            labor.toPlainString(),
            "Planned material cost",
            materials.toPlainString()));
    rows.add(List.of("Status", p.status().name(), "Progress", p.progress().toPlainString() + "%"));
    rows.add(
        List.of(
            "Approved budget",
            p.approvedBudget().toPlainString(),
            "Expenditure",
            p.actualExpenditure().toPlainString()));
    rows.add(
        List.of(
            "Deadline",
            (p.revisedEndDate() == null ? p.plannedEndDate() : p.revisedEndDate()).toString()));
    for (String section : List.of("assignments", "tasks", "resources", "requests")) {
      rows.add(List.of(""));
      rows.add(List.of(section.toUpperCase(Locale.ROOT)));
      @SuppressWarnings("unchecked")
      var records = (List<Map<String, Object>>) data.get(section);
      if (taskId != null && section.equals("tasks"))
        records = records.stream().filter(r -> Objects.equals(r.get("id"), taskId)).toList();
      if (taskId != null && Set.of("resources", "requests").contains(section))
        records = records.stream().filter(r -> Objects.equals(r.get("task_id"), taskId)).toList();
      records =
          records.stream()
              .map(
                  r -> {
                    var copy = new LinkedHashMap<>(r);
                    copy.remove("authorized_plan");
                    copy.remove("plan_snapshot");
                    return (Map<String, Object>) copy;
                  })
              .toList();
      if (records.isEmpty()) {
        rows.add(List.of("No records"));
        continue;
      }
      rows.add(new ArrayList<>(records.getFirst().keySet()));
      for (var record : records)
        rows.add(record.values().stream().map(v -> v == null ? "" : v.toString()).toList());
    }
    return rows;
  }

  private String xml(String s) {
    return s.replaceAll("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]", "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;");
  }

  private void entry(ZipOutputStream zip, String name, String text) throws IOException {
    zip.putNextEntry(new ZipEntry(name));
    zip.write(text.getBytes(StandardCharsets.UTF_8));
    zip.closeEntry();
  }

  public byte[] excel(Long id) throws IOException {
    return excel(id, null);
  }

  public byte[] excel(Long id, Long taskId) throws IOException {
    var rows = rows(id, taskId);
    var bytes = new ByteArrayOutputStream();
    try (var zip = new ZipOutputStream(bytes)) {
      entry(
          zip,
          "[Content_Types].xml",
          "<?xml version=\"1.0\"?><Types"
              + " xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default"
              + " Extension=\"rels\""
              + " ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default"
              + " Extension=\"xml\" ContentType=\"application/xml\"/><Override"
              + " PartName=\"/xl/workbook.xml\""
              + " ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override"
              + " PartName=\"/xl/worksheets/sheet1.xml\""
              + " ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/></Types>");
      entry(
          zip,
          "_rels/.rels",
          "<?xml version=\"1.0\"?><Relationships"
              + " xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship"
              + " Id=\"rId1\""
              + " Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\""
              + " Target=\"xl/workbook.xml\"/></Relationships>");
      entry(
          zip,
          "xl/workbook.xml",
          "<?xml version=\"1.0\"?><workbook"
              + " xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\""
              + " xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet"
              + " name=\"Project report\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>");
      entry(
          zip,
          "xl/_rels/workbook.xml.rels",
          "<?xml version=\"1.0\"?><Relationships"
              + " xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship"
              + " Id=\"rId1\""
              + " Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\""
              + " Target=\"worksheets/sheet1.xml\"/></Relationships>");
      var sheet =
          new StringBuilder(
              "<?xml version=\"1.0\" encoding=\"UTF-8\"?><worksheet"
                  + " xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>");
      for (var row : rows) {
        sheet.append("<row>");
        for (var cell : row)
          sheet
              .append("<c t=\"inlineStr\"><is><t xml:space=\"preserve\">")
              .append(xml(cell))
              .append("</t></is></c>");
        sheet.append("</row>");
      }
      sheet.append("</sheetData></worksheet>");
      entry(zip, "xl/worksheets/sheet1.xml", sheet.toString());
    }
    return bytes.toByteArray();
  }

  private byte[] ascii(String text) {
    return text.getBytes(StandardCharsets.ISO_8859_1);
  }

  public byte[] pdf(Long id) throws IOException {
    return pdf(id, null);
  }

  public byte[] pdf(Long id, Long taskId) throws IOException {
    var lines = new ArrayList<String>();
    for (var row : rows(id, taskId)) {
      String line = String.join(" | ", row).replaceAll("[^\\x20-\\x7e]", "?");
      while (line.length() > 110) {
        lines.add(line.substring(0, 110));
        line = line.substring(110);
      }
      lines.add(line);
    }
    int pages = Math.max(1, (lines.size() + 49) / 50);
    var objects = new ArrayList<byte[]>();
    objects.add(ascii("<< /Type /Catalog /Pages 2 0 R >>"));
    var kids = new StringBuilder();
    for (int i = 0; i < pages; i++) kids.append(4 + i * 2).append(" 0 R ");
    objects.add(ascii("<< /Type /Pages /Count " + pages + " /Kids [" + kids + "] >>"));
    objects.add(ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>"));
    for (int page = 0; page < pages; page++) {
      objects.add(
          ascii(
              "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0"
                  + " R >> >> /Contents "
                  + (5 + page * 2)
                  + " 0 R >>"));
      var stream = new StringBuilder("BT /F1 8 Tf 10 TL 24 570 Td ");
      for (int i = page * 50; i < Math.min(lines.size(), (page + 1) * 50); i++)
        stream
            .append('(')
            .append(lines.get(i).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)"))
            .append(") Tj T*\n");
      stream.append("ET");
      byte[] content = ascii(stream.toString());
      objects.add(ascii("<< /Length " + content.length + " >>\nstream\n" + stream + "\nendstream"));
    }
    var out = new ByteArrayOutputStream();
    out.write(ascii("%PDF-1.4\n"));
    var offsets = new ArrayList<Integer>();
    for (int i = 0; i < objects.size(); i++) {
      offsets.add(out.size());
      out.write(ascii((i + 1) + " 0 obj\n"));
      out.write(objects.get(i));
      out.write(ascii("\nendobj\n"));
    }
    int xref = out.size();
    out.write(ascii("xref\n0 " + (objects.size() + 1) + "\n0000000000 65535 f \n"));
    for (int offset : offsets)
      out.write(ascii(String.format(Locale.ROOT, "%010d 00000 n \n", offset)));
    out.write(
        ascii(
            "trailer\n<< /Size "
                + (objects.size() + 1)
                + " /Root 1 0 R >>\nstartxref\n"
                + xref
                + "\n%%EOF\n"));
    return out.toByteArray();
  }
}
