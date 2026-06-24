namespace ShipBattle.Services;

public class GameValidationService
{
    public bool ValidateShipPlacement(int[][] shipCoordinates, int gridSize, int maxShipSize)
    {
        var requiredShips = new Dictionary<int, int>();
        int expectedTotalCells = 0;

        for (int size = maxShipSize; size >= 1; size--)
        {
            int count = maxShipSize - size + 1;
            requiredShips[size] = count;
            expectedTotalCells += size * count;
        }

        if (shipCoordinates == null || shipCoordinates.Length != expectedTotalCells) return false;

        var grid = new bool[gridSize, gridSize];
        for (int i = 0; i < shipCoordinates.Length; i++)
        {
            if (shipCoordinates[i] == null || shipCoordinates[i].Length != 2) return false;

            int x = shipCoordinates[i][0];
            int y = shipCoordinates[i][1];

            if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return false;
            if (grid[x, y]) return false;

            grid[x, y] = true;
        }

        var visited = new bool[gridSize, gridSize];
        var foundShips = new Dictionary<int, int>();

        for (int x = 0; x < gridSize; x++)
        {
            for (int y = 0; y < gridSize; y++)
            {
                if (grid[x, y] && !visited[x, y])
                {
                    int size = TraverseShip(grid, visited, x, y, gridSize);
                    if (size == -1 || size > maxShipSize) return false;

                    if (!foundShips.TryAdd(size, 1))
                    {
                        foundShips[size]++;
                    }
                }
            }
        }

        foreach (var req in requiredShips)
        {
            if (!foundShips.ContainsKey(req.Key) || foundShips[req.Key] != req.Value)
            {
                return false;
            }
        }

        return true;
    }

    private int TraverseShip(bool[,] grid, bool[,] visited, int startX, int startY, int gridSize)
    {
        int size = 0;
        var queue = new Queue<(int x, int y)>();
        queue.Enqueue((startX, startY));
        visited[startX, startY] = true;

        bool isHorizontal = false;
        bool isVertical = false;

        while (queue.Count > 0)
        {
            var (x, y) = queue.Dequeue();
            size++;

            if (!CheckDiagonalClearance(grid, x, y, gridSize)) return -1;

            var neighbors = new[] { (x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1) };

            foreach (var (nx, ny) in neighbors)
            {
                if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && grid[nx, ny])
                {
                    if (nx != x) isHorizontal = true;
                    if (ny != y) isVertical = true;

                    if (isHorizontal && isVertical) return -1;

                    if (!visited[nx, ny])
                    {
                        visited[nx, ny] = true;
                        queue.Enqueue((nx, ny));
                    }
                }
            }
        }
        return size;
    }

    private bool CheckDiagonalClearance(bool[,] grid, int x, int y, int gridSize)
    {
        var diagonals = new[] { (x - 1, y - 1), (x + 1, y - 1), (x - 1, y + 1), (x + 1, y + 1) };
        foreach (var (dx, dy) in diagonals)
        {
            if (dx >= 0 && dx < gridSize && dy >= 0 && dy < gridSize && grid[dx, dy])
            {
                return false;
            }
        }
        return true;
    }
}