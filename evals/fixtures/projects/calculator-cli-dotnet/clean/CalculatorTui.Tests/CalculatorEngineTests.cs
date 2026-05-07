using CalculatorTui;

namespace CalculatorTui.Tests;

public class CalculatorEngineTests
{
    [Fact]
    public void Add_WhenTwoNumbersProvided_ShouldReturnSum()
    {
        var calculator = new CalculatorEngine();

        var result = calculator.Add(2m, 3m);

        Assert.Equal(5m, result);
    }

    [Fact]
    public void Subtract_WhenTwoNumbersProvided_ShouldReturnDifference()
    {
        var calculator = new CalculatorEngine();

        var result = calculator.Subtract(5m, 3m);

        Assert.Equal(2m, result);
    }
}