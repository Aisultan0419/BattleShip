namespace ShipBattle.Models;

public class CreateUserDto
{
    public string DisplayName { get; set; } = string.Empty;
}

public class GameStateDto
{
    public string RoomId { get; set; } = string.Empty;
    public GameState State { get; set; }
    public Guid CurrentTurnUserId { get; set; }
    public int GridSize { get; set; }
    public int MaxShipSize { get; set; }
    public Dictionary<Guid, PlayerStateDto> Players { get; set; } = new();
}

public class PlayerStateDto
{
    public bool IsReady { get; set; }
    public CellState[][] Board { get; set; } = null!;
}