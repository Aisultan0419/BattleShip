namespace ShipBattle.Models;

public enum CellState
{
    Empty,
    Ship,
    Miss,
    Hit,
    Sunk
}

public enum GameState
{
    WaitingForPlayer,
    PlacingShips,
    Battle,
    GameOver
}