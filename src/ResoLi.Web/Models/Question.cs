using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResoLi.Web.Models;

public class Question
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid PollId { get; set; }

    [ForeignKey(nameof(PollId))]
    public Poll? Poll { get; set; }

    public int OrderIndex { get; set; }

    [MaxLength(200)]
    public string? Title { get; set; }

    [Required]
    public string Content { get; set; } = string.Empty;

    public bool UseMonospace { get; set; }

    public bool AllowMultiple { get; set; }

    public bool IsActive { get; set; }

    [MaxLength(500)]
    public string? ImagePath { get; set; }

    public List<Option> Options { get; set; } = new();
}
