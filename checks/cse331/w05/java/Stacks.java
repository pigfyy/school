import java.util.*;

/**
 * Lecture 13's ListStack.divide and DraftStack.divide, as the notes print them, on a list of numbers bottom first,
 * with the CalcException family nested in an interface as the notes' CalcStack nests it. main runs 6 0 / on each
 * and prints the stack afterward, as the calculator's p does.
 */
interface CalcStack {
    class CalcException extends RuntimeException { public CalcException(String m) { super(m); } }
    class StackEmptyException extends CalcException { public StackEmptyException(String m) { super(m); } }
    class TooFewOperandsException extends CalcException { public TooFewOperandsException(String m) { super(m); } }
    class DivideByZeroException extends CalcException { public DivideByZeroException(String m) { super(m); } }
}

class ListStack implements CalcStack {
    List<Integer> items = new ArrayList<Integer>();
    void push(int n) { items.add(n); }
    int pop() { if (items.isEmpty()) throw new StackEmptyException("stack is empty"); return items.remove(items.size() - 1); }
    int top() { if (items.isEmpty()) throw new StackEmptyException("stack is empty"); return items.get(items.size() - 1); }
    public void divide() {
        if (items.size() < 2) {
            throw new TooFewOperandsException(
                "need two numbers to divide");
        }
        if (top() == 0) {
            throw new DivideByZeroException("cannot divide by zero");
        }
        int b = pop(); int a = pop();
        push(a / b);
    }
}

class DraftStack extends ListStack {
    @Override public void divide() {
        if (items.size() < 2) {
            throw new TooFewOperandsException(
                "need two numbers to divide");
        }
        int b = pop(); int a = pop();
        if (b == 0) {
            throw new DivideByZeroException("cannot divide by zero");
        }
        push(a / b);
    }
}

public class Stacks {
    public static void main(String[] args) {
        for (ListStack s : new ListStack[] { new ListStack(), new DraftStack() }) {
            s.push(6); s.push(0);
            try { s.divide(); } catch (CalcStack.CalcException e) { System.out.println("error: " + e.getMessage()); }
            System.out.println(s.items);
        }
    }
}
