using System.ComponentModel.DataAnnotations;

namespace ResoLi.Web.Models;

public class Poll
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(50)]
    public string AccessCode { get; set; } = string.Empty;

    [Required]
    public string PasswordHash { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? AvailableFrom { get; set; }

    public DateTime? AvailableUntil { get; set; }

    public int? TimeoutMinutes { get; set; }

    public bool IsPublic { get; set; }

    public List<Question> Questions { get; set; } = new();
}
