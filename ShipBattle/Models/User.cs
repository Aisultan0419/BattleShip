using System.ComponentModel.DataAnnotations;

namespace ShipBattle.Models;

public class User
{
    [Key]
    public Guid Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string DisplayName { get; set; } = string.Empty;

    public int Wins { get; set; }

    public int Losses { get; set; }
}