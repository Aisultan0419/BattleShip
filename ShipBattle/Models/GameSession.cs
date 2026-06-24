namespace ShipBattle.Models;

public class PlayerState
{
    public Guid UserId { get; set; }
    public string ConnectionId { get; set; } = string.Empty;
    public bool IsReady { get; set; }
    public CellState[,] Board { get; set; } = null!;
    public int AliveShipCells { get; set; }
}

public class GameSession
{
    public string RoomId { get; set; } = string.Empty;
    public GameState State { get; set; } = GameState.WaitingForPlayer;
    public Dictionary<Guid, PlayerState> Players { get; set; } = new();
    public Guid CurrentTurnUserId { get; set; }
    public int GridSize { get; set; }
    public int MaxShipSize { get; set; }
    public readonly object SyncRoot = new();
}