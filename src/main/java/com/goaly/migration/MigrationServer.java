package com.goaly.migration;

import com.google.gson.*;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.HttpEntity;
import org.apache.hc.core5.http.io.entity.StringEntity;

import java.nio.charset.StandardCharsets;
import java.util.Scanner;

public class MigrationServer {
    private static final String DRIVE_MOCK_URL = "http://localhost:8081/drive/v3/files";
    private static final String TASK_MOCK_URL = "http://localhost:8082/tasks/v1/lists/default/tasks";
    private static final Gson gson = new GsonBuilder().setPrettyPrinting().create();

    public static void main(String[] args) throws Exception {
        System.out.println("Starting Goaly Migration Server");

        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            // 1. List files from Drive Mock
            System.out.println("Fetching file list from Drive Mock...");
            String filesJson = fetch(httpClient, DRIVE_MOCK_URL);
            JsonObject filesResp = JsonParser.parseString(filesJson).getAsJsonObject();
            JsonArray files = filesResp.getAsJsonArray("files");

            for (JsonElement fileElem : files) {
                JsonObject file = fileElem.getAsJsonObject();
                String fileName = file.get("name").getAsString();
                String fileId = file.get("id").getAsString();

                if (fileName.endsWith(".json")) {
                    System.out.println("Migrating file: " + fileName);
                    
                    // 2. Download file content
                    String downloadUrl = DRIVE_MOCK_URL + "/" + fileId + "?alt=media";
                    String content = fetch(httpClient, downloadUrl);
                    
                    // 3. Parse Goaly v1 format
                    JsonObject root = JsonParser.parseString(content).getAsJsonObject();
                    if (root.has("goals")) {
                        JsonArray goals = root.getAsJsonArray("goals");
                        for (JsonElement goalElem : goals) {
                            JsonObject goal = goalElem.getAsJsonObject();
                            migrateGoal(httpClient, goal);
                        }
                    }
                }
            }

            System.out.println("✓ Migration completed successfully!");

        } catch (Exception e) {
            System.err.println("✗ Migration failed: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static void migrateGoal(CloseableHttpClient httpClient, JsonObject goal) throws Exception {
        JsonObject task = new JsonObject();
        task.addProperty("title", goal.get("title").getAsString());
        if (goal.has("deadline") && !goal.get("deadline").isJsonNull()) {
            task.addProperty("due", goal.get("deadline").getAsString());
        }
        task.addProperty("status", "completed".equals(goal.get("status").getAsString()) ? "completed" : "needsAction");
        
        // Metadata in notes
        JsonObject metadata = new JsonObject();
        metadata.addProperty("motivation", goal.get("motivation").getAsInt());
        metadata.addProperty("urgency", goal.get("urgency").getAsInt());
        metadata.addProperty("isRecurring", goal.get("isRecurring").getAsBoolean());
        metadata.addProperty("version", "1.0");
        task.addProperty("notes", gson.toJson(metadata));

        System.out.println("  Inserting Todo: " + task.get("title").getAsString());
        String taskResp = post(httpClient, TASK_MOCK_URL, task);
        JsonObject createdTask = JsonParser.parseString(taskResp).getAsJsonObject();
        String parentId = createdTask.get("id").getAsString();

        // Migrate steps as subtasks
        if (goal.has("steps")) {
            JsonArray steps = goal.getAsJsonArray("steps");
            for (JsonElement stepElem : steps) {
                JsonObject step = stepElem.getAsJsonObject();
                JsonObject subtask = new JsonObject();
                subtask.addProperty("title", step.get("text").getAsString());
                subtask.addProperty("status", step.get("completed").getAsBoolean() ? "completed" : "needsAction");
                subtask.addProperty("parent", parentId);
                
                System.out.println("    Inserting Step: " + subtask.get("title").getAsString());
                post(httpClient, TASK_MOCK_URL, subtask);
            }
        }
    }

    private static String fetch(CloseableHttpClient httpClient, String url) throws Exception {
        HttpGet request = new HttpGet(url);
        return httpClient.execute(request, response -> {
            HttpEntity entity = response.getEntity();
            Scanner scanner = new Scanner(entity.getContent(), StandardCharsets.UTF_8.name());
            return scanner.useDelimiter("\\A").hasNext() ? scanner.next() : "";
        });
    }

    private static String post(CloseableHttpClient httpClient, String url, JsonObject body) throws Exception {
        HttpPost request = new HttpPost(url);
        request.setEntity(new StringEntity(gson.toJson(body), ContentType.APPLICATION_JSON));
        return httpClient.execute(request, response -> {
            if (response.getCode() >= 300) {
                throw new RuntimeException("Failed to post task: " + response.getCode());
            }
            HttpEntity entity = response.getEntity();
            Scanner scanner = new Scanner(entity.getContent(), StandardCharsets.UTF_8.name());
            return scanner.useDelimiter("\\A").hasNext() ? scanner.next() : "";
        });
    }
}
