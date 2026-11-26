
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Voxora.Api.Data;
using Voxora.Api.Models;

namespace Voxora.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CategoriesController : ControllerBase
{
    private readonly VoxoraDbContext _context;

    public CategoriesController(VoxoraDbContext context)
    {
        _context = context;
    }

    // GET: api/categories
    [HttpGet]
    public async Task<IActionResult> GetCategories()
    {
        var categories = await _context.Categories
            .Where(c => c.IsActive)
            .OrderBy(c => c.Name)
            .Select(c => new
            {
                id = c.Id,
                name = c.Name,
                description = c.Description
            })
            .ToListAsync();

        return Ok(categories);
    }

    // POST: api/categories
    [HttpPost]
    public async Task<IActionResult> AddCategory(
        [FromBody] CategoryRequest request)
    {
        var name = request.Name.Trim();

        if (string.IsNullOrWhiteSpace(name))
            return BadRequest("Category name is required.");

        bool exists = await _context.Categories
            .AnyAsync(c => c.Name == name);

        if (exists)
            return Conflict("Category already exists.");

        var category = new Category
        {
            Name = name,
            Description = request.Description?.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Categories.Add(category);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Category added successfully.",
            id = category.Id,
            name = category.Name,
            description = category.Description
        });
    }

    // PUT: api/categories/1
    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateCategory(
        int id,
        [FromBody] CategoryRequest request)
    {
        var category = await _context.Categories
            .FirstOrDefaultAsync(c => c.Id == id && c.IsActive);

        if (category == null)
            return NotFound("Category not found.");

        var name = request.Name.Trim();

        if (string.IsNullOrWhiteSpace(name))
            return BadRequest("Category name is required.");

        bool exists = await _context.Categories
            .AnyAsync(c => c.Id != id && c.Name == name);

        if (exists)
            return Conflict("Category name already exists.");

        category.Name = name;
        category.Description = request.Description?.Trim();

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Category updated successfully.",
            id = category.Id,
            name = category.Name,
            description = category.Description
        });
    }

    // DELETE: api/categories/1
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        var category = await _context.Categories
            .FirstOrDefaultAsync(c => c.Id == id && c.IsActive);

        if (category == null)
            return NotFound("Category not found.");

        // Soft delete: keep existing concern records safe.
        category.IsActive = false;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Category deleted successfully."
        });
    }
}

public class CategoryRequest
{
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }
}
