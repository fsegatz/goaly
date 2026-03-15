package com.goaly.mock.tasks;

import static spark.Spark.*;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.io.File;
import java.io.IOException;
import java.util.UUID;

public class GoogleTaskServerMock {
    private static final String DATA_PATH = "data/taskServer/data.json";
    private static final Gson gson = new Gson();

    public static void main(String[] args) {
        port(8082);
        
        // Ensure data directory exists
        new File("data/taskServer").mkdirs();

        // --- TaskLists ---
        
        // List TaskLists
        get("/tasks/v1/users/@me/lists", (req, res) -> {
            res.type("application/json");
            JsonObject data = loadData();
            JsonObject response = new JsonObject();
            response.add("items", data.getAsJsonArray("tasklists"));
            return gson.toJson(response);
        });

        // Insert TaskList
        post("/tasks/v1/users/@me/lists", (req, res) -> {
            res.type("application/json");
            JsonObject newList = gson.fromJson(req.body(), JsonObject.class);
            newList.addProperty("id", UUID.randomUUID().toString());
            
            JsonObject data = loadData();
            data.getAsJsonArray("tasklists").add(newList);
            saveData(data);
            
            return gson.toJson(newList);
        });

        // Delete TaskList
        delete("/tasks/v1/users/@me/lists/:listId", (req, res) -> {
            String listId = req.params(":listId");
            JsonObject data = loadData();
            JsonArray lists = data.getAsJsonArray("tasklists");
            for (int i = 0; i < lists.size(); i++) {
                if (lists.get(i).getAsJsonObject().get("id").getAsString().equals(listId)) {
                    lists.remove(i);
                    break;
                }
            }
            saveData(data);
            res.status(204);
            return "";
        });

        // --- Tasks ---

        // List Tasks
        get("/tasks/v1/lists/:listId/tasks", (req, res) -> {
            res.type("application/json");
            String listId = req.params(":listId");
            JsonObject data = loadData();
            JsonArray tasks = data.getAsJsonArray("tasks");
            JsonArray filtered = new JsonArray();
            for (JsonElement t : tasks) {
                // For simplicity in mock, if no listId mapping, just return all
                // In real API tasks belong to lists.
                filtered.add(t);
            }
            JsonObject response = new JsonObject();
            response.add("items", filtered);
            return gson.toJson(response);
        });

        // Insert Task
        post("/tasks/v1/lists/:listId/tasks", (req, res) -> {
            res.type("application/json");
            JsonObject newTask = gson.fromJson(req.body(), JsonObject.class);
            newTask.addProperty("id", UUID.randomUUID().toString());
            
            JsonObject data = loadData();
            data.getAsJsonArray("tasks").add(newTask);
            saveData(data);
            
            res.status(201);
            return gson.toJson(newTask);
        });

        // Update Task (Patch)
        patch("/tasks/v1/lists/:listId/tasks/:taskId", (req, res) -> {
            res.type("application/json");
            String taskId = req.params(":taskId");
            JsonObject updates = gson.fromJson(req.body(), JsonObject.class);
            
            JsonObject data = loadData();
            JsonArray tasks = data.getAsJsonArray("tasks");
            JsonObject found = null;
            for (JsonElement t : tasks) {
                if (t.getAsJsonObject().get("id").getAsString().equals(taskId)) {
                    found = t.getAsJsonObject();
                    break;
                }
            }
            
            if (found != null) {
                for (String key : updates.keySet()) {
                    found.add(key, updates.get(key));
                }
                saveData(data);
                return gson.toJson(found);
            }
            
            res.status(404);
            return "{\"error\": \"Task not found\"}";
        });

        // Delete Task
        delete("/tasks/v1/lists/:listId/tasks/:taskId", (req, res) -> {
            String taskId = req.params(":taskId");
            JsonObject data = loadData();
            JsonArray tasks = data.getAsJsonArray("tasks");
            for (int i = 0; i < tasks.size(); i++) {
                if (tasks.get(i).getAsJsonObject().get("id").getAsString().equals(taskId)) {
                    tasks.remove(i);
                    break;
                }
            }
            saveData(data);
            res.status(204);
            return "";
        });

        System.out.println("GoogleTaskServerMock running on port 8082");
    }

    private static synchronized JsonObject loadData() {
        try {
            if (Files.exists(Paths.get(DATA_PATH))) {
                String content = new String(Files.readAllBytes(Paths.get(DATA_PATH)));
                return gson.fromJson(content, JsonObject.class);
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
        JsonObject data = new JsonObject();
        data.add("tasklists", new JsonArray());
        data.add("tasks", new JsonArray());
        return data;
    }

    private static synchronized void saveData(JsonObject data) {
        try {
            Files.write(Paths.get(DATA_PATH), gson.toJson(data).getBytes());
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
