package com.goaly.mock.drive;

import static spark.Spark.*;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonArray;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.stream.Stream;

public class GoogleDriveServerMock {
    private static final String DRIVE_FILES_DIR = "data/driveServer";

    public static void main(String[] args) {
        port(8081);
        Gson gson = new Gson();

        get("/todos", (req, res) -> "[\"Mocked todo list\"]");
        post("/todos", (req, res) -> "{\"result\":\"Created\"}");

        // Drive API Mocks
        get("/drive/v3/files", (req, res) -> {
            res.type("application/json");
            JsonObject response = new JsonObject();
            JsonArray filesArray = new JsonArray();

            try (Stream<Path> paths = Files.walk(Paths.get(DRIVE_FILES_DIR))) {
                paths.filter(Files::isRegularFile).forEach(path -> {
                    JsonObject fileObj = new JsonObject();
                    String fileName = path.getFileName().toString();
                    fileObj.addProperty("id", fileName);
                    fileObj.addProperty("name", fileName);
                    filesArray.add(fileObj);
                });
            } catch (Exception e) {
                res.status(500);
                return "{\"error\": \"Failed to read directory\"}";
            }

            response.add("files", filesArray);
            return gson.toJson(response);
        });

        get("/drive/v3/files/:fileId", (req, res) -> {
            String fileId = req.params(":fileId");
            String alt = req.queryParamOrDefault("alt", "");

            if (!"media".equals(alt)) {
                res.status(400);
                return "{\"error\": \"Only alt=media is supported by this mock implementation.\"}";
            }

            try (Stream<Path> paths = Files.walk(Paths.get(DRIVE_FILES_DIR))) {
                Path foundFile = paths.filter(Files::isRegularFile)
                        .filter(path -> path.getFileName().toString().equals(fileId))
                        .findFirst()
                        .orElse(null);

                if (foundFile == null) {
                    res.status(404);
                    return "{\"error\": \"File not found\"}";
                }

                res.type("application/octet-stream"); // Or more specific based on extension if needed
                byte[] fileBytes = Files.readAllBytes(foundFile);
                res.raw().getOutputStream().write(fileBytes);
                res.raw().getOutputStream().flush();
                return ""; // Spark requires a return value
            } catch (Exception e) {
                res.status(500);
                return "{\"error\": \"Failed to read file\"}";
            }
        });

        System.out.println("GoogleDriveServerMock running on port 8081");
    }
}
