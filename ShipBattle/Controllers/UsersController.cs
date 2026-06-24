using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShipBattle.Infrastructure;
using ShipBattle.Models;

namespace ShipBattle.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public UsersController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpPost]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.DisplayName) || dto.DisplayName.Length > 50)
            return BadRequest();

        string displayName = dto.DisplayName.Trim();
        int suffix = 2;
        string finalName = displayName;

        while (await _context.Users.AnyAsync(u => u.DisplayName == finalName))
        {
            finalName = $"{displayName} {suffix}";
            suffix++;
        }

        var user = new User { Id = Guid.NewGuid(), DisplayName = finalName };
        _context.Users.Add(user);

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict();
        }

        return Ok(user);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetUser(Guid id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();
        return Ok(user);
    }

}