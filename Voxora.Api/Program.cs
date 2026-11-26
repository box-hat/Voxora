
using Microsoft.EntityFrameworkCore;
using Voxora.Api.Data;
using Voxora.Api.Hubs;

var builder = WebApplication.CreateBuilder(args);

// OpenAPI
builder.Services.AddOpenApi();

// Register API Controllers
builder.Services.AddControllers();

// SignalR (real-time concern updates)
builder.Services.AddSignalR();

// MySQL Database Connection
var connectionString = builder.Configuration
    .GetConnectionString("DefaultConnection");

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "MySQL connection string is missing.");
}

builder.Services.AddDbContext<VoxoraDbContext>(options =>
    options.UseMySQL(connectionString));

// Allow Angular frontend to access the API
builder.Services.AddCors(options =>
{
    options.AddPolicy("AngularClient", policy =>
    {
        policy
           .WithOrigins(
    "http://localhost:4200",
    "https://localhost:4200",
    "http://localhost:49609",
    "http://10.0.250.173:4200",
    "https://10.0.250.173:4200"
)
            .AllowAnyHeader()
            .AllowAnyMethod()
            // Required by SignalR when the client connects cross-origin
            .AllowCredentials();
    });
});

var app = builder.Build();

// OpenAPI
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// CORS
app.UseCors("AngularClient");

app.UseHttpsRedirection();

// Register Controllers
app.MapControllers();

// SignalR hub
app.MapHub<ConcernsHub>(ConcernsHub.Path);

// Test MySQL connection
app.MapGet("/api/health/database", async (VoxoraDbContext db) =>
{
    var connected = await db.Database.CanConnectAsync();

    return Results.Ok(new
    {
        database = "voxora_db",
        connected = connected
    });
});

app.Run();
