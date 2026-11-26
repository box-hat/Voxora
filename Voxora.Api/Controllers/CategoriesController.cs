using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Voxora.Api.Data;
using Voxora.Api.Models;

namespace Voxora.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CategoriesController : ControllerBase
{
    private const int NameMax = 100;
    private const int DescriptionMax = 1000;

    private readonly VoxoraDbContext _context;

    public CategoriesController(VoxoraDbContext context)
    {
        _context = context;
    }

    // GET: api/categories (public: used by the submit form)
    [HttpGet]
    public async Task<IActionResult> GetCategories()
    {
        var categories = await _context.Categories
            .AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.Name)
            .Select(c => new { id = c.Id, name = c.Name, description = c.Description })
            .ToListAsync();

        return Ok(categories);
    }

    // POST: api/categories
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> AddCategory([FromBody] CategoryRequest request)
    {
        if (Validate(request, out var name, out var description) is { } error)
            return error;

        var existing = await _context.Categories.FirstOrDefaultAsync(c => c.Name == name);

        if (existing is { IsActive: true })
            return Conflict(new { message = "Category already exists." });

        Category category;

        if (existing is not null)
        {
            // Re-adding a deleted category restores it (its concerns still point to it).
            category = existing;
            category.IsActive = true;
            category.Description = description;
        }
        else
        {
            category = new Category
            {
                Name = name,
                Description = description,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            _context.Categories.Add(category);
        }

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
    [Authorize]
    public async Task<IActionResult> UpdateCategory(int id, [FromBody] CategoryRequest request)
    {
        if (Validate(request, out var name, out var description) is { } error)
            return error;

        var category = await _context.Categories.FirstOrDefaultAsync(c => c.Id == id && c.IsActive);

        if (category is null)
            return NotFound(new { message = "Category not found." });

        if (await _context.Categories.AnyAsync(c => c.Id != id && c.Name == name))
            return Conflict(new { message = "Category name already exists." });

        category.Name = name;
        category.Description = description;

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
    [Authorize]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        var category = await _context.Categories.FirstOrDefaultAsync(c => c.Id == id && c.IsActive);

        if (category is null)
            return NotFound(new { message = "Category not found." });

        // Soft delete: existing concerns keep their category.
        category.IsActive = false;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Category deleted successfully." });
    }

    private BadRequestObjectResult? Validate(CategoryRequest request, out string name, out string? description)
    {
        name = request.Name?.Trim() ?? string.Empty;
        description = request.Description?.Trim();

        if (string.IsNullOrEmpty(description))
            description = null;

        if (name.Length == 0)
            return BadRequest(new { message = "Category name is required." });

        if (name.Length > NameMax)
            return BadRequest(new { message = $"Category name must not exceed {NameMax} characters." });

        if (description?.Length > DescriptionMax)
            return BadRequest(new { message = $"Description must not exceed {DescriptionMax} characters." });

        return null;
    }
}

public class CategoryRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
}
