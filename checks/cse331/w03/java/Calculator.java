import java.util.*;

/**
 * An interactive stack-based integer calculator.
 *
 * Numbers and operations are separated by spaces. Numbers get pushed
 * onto the stack. An operation like + pops the top two numbers,
 * combines them, and pushes the answer back onto the stack.
 *
 *   > 1 2 +
 *   > .
 *   3
 *
 * This computes 1 + 2 = 3 using the stack. It pushes 1 and 2, then
 * pops them, adds them, and pushes the result.
 *
 *   > 1 2 -
 *   > .
 *   -1
 *
 * For operations where the order of the arguments matters, the
 * number that was second-from-the-top is on the left of the
 * operator, which is why the above program computes 1 - 2 = -1
 * rather than 2 - 1 = 1.
 *
 * Commands:
 *   a number   push it onto the stack
 *   +          pop two numbers, push their sum
 *   -          pop two numbers, push (second - first)
 *   *          pop two numbers, push their product
 *   /          pop two numbers, push (second / first), int div
 *   p          print the whole stack
 *   .          pop the top number and print it
 *   t          print the top number without removing it
 *   q          quit
 */
public class Calculator {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        CalcStack stack = new CalcStack();
        while (true) {
            System.out.print("> ");
            if (!in.hasNextLine()) {
                break;
            }
            String line = in.nextLine();
            String[] tokens = line.split("\\s+");
            for (String token : tokens) {
                if (token.equals("")) {
                    continue;
                } else if (token.equals("q")) {
                    return;
                } else if (token.equals("p")) {
                    System.out.println(stack);
                } else if (token.equals(".")) {
                    Integer top = stack.pop();
                    if (top == null) {
                        System.out.println("error: stack is empty");
                    } else {
                        System.out.println(top);
                    }
                } else if (token.equals("t")) {
                    OptionalInt top = stack.top();
                    if (top.isEmpty()) {
                        System.out.println("error: stack is empty");
                    } else {
                        System.out.println(top.getAsInt());
                    }
                } else if (token.equals("+")) {
                    boolean ok = stack.add();
                    if (!ok) {
                        System.out.println(
                            "error: need two numbers to add");
                    }
                } else if (token.equals("-")) {
                    try {
                        stack.subtract();
                    } catch (StackException e) {
                        System.out.println(
                            "error: " + e.getMessage());
                    }
                } else if (token.equals("*")) {
                    if (stack.size() < 2) {
                        System.out.println(
                            "error: need two numbers to multiply");
                    } else {
                        stack.multiply();
                    }
                } else if (token.equals("/")) {
                    try {
                        stack.divide();
                    } catch (TooFewOperandsException e) {
                        System.out.println(
                            "error: " + e.getMessage());
                    } catch (DivideByZeroException e) {
                        System.out.println(
                            "error: " + e.getMessage());
                    }
                } else {
                    try {
                        int value = Integer.parseInt(token);
                        stack.push(value);
                    } catch (NumberFormatException e) {
                        System.out.println("error: don't understand '"
                            + token + "'");
                    }
                }
            }
        }
    }
}

class CalcStack {
    private List<Integer> items = new ArrayList<Integer>();

    /** @return the number of numbers on the stack */
    public int size() { return items.size(); }

    /**
     * @modifies this
     * @effects pushes value onto the top of the stack
     */
    public void push(int value) { items.add(value); }

    /**
     * @modifies this
     * @effects removes the top number from the stack, if the stack is
     *     non-empty
     * @return the number removed, or null if the stack was empty
     */
    public Integer pop() {
        if (items.size() == 0) { return null; }
        int last = items.remove(items.size() - 1);
        return last;
    }

    /**
     * @return an OptionalInt holding the top number of the stack, or
     *     an empty OptionalInt if the stack is empty
     */
    public OptionalInt top() {
        if (items.size() == 0) { return OptionalInt.empty(); }
        return OptionalInt.of(items.get(items.size() - 1));
    }

    /**
     * @modifies this
     * @effects if the stack has at least two numbers, pops the top
     *     two and pushes their sum; otherwise leaves the stack
     *     unchanged
     * @return true if the top two numbers were replaced with their
     *     sum, or false if the stack had fewer than two numbers
     */
    public boolean add() {
        if (items.size() < 2) { return false; }
        int b = pop(); int a = pop();
        push(a + b);
        return true;
    }

    /**
     * @modifies this
     * @effects if the stack has at least two numbers, pops the top
     *     two (first and second) and pushes second - first; otherwise
     *     does nothing
     * @throws StackException if the stack had fewer than two numbers
     */
    public void subtract() throws StackException {
        if (items.size() < 2) {
            throw new StackException("need two numbers to subtract");
        }
        int b = pop(); int a = pop();
        push(a - b);
    }

    /**
     * @requires 2 <= size()
     * @modifies this
     * @effects pops the top two numbers and pushes their product
     */
    public void multiply() {
        int b = pop(); int a = pop();
        push(a * b);
    }

    /**
     * @modifies this
     * @effects if the stack has at least two numbers and the top
     *     number is non-zero, pops the top two (first and second) and
     *     pushes second / first; otherwise leaves the stack unchanged
     * @throws TooFewOperandsException if the stack had fewer than two
     *     numbers
     * @throws DivideByZeroException if the divisor (the top number)
     *     was zero
     */
    public void divide() {
        if (items.size() < 2) {
            throw new TooFewOperandsException(
                "need two numbers to divide");
        }
        int b = pop(); int a = pop();
        if (b == 0) {
            push(a); push(b);
            throw new DivideByZeroException("cannot divide by zero");
        }
        push(a / b);
    }

    /**
     * @return a string showing the stack's numbers from bottom to top
     */
    public String toString() {
        String result = "[";
        for (int i = 0; i < items.size(); i++) {
            if (i > 0) { result = result + " "; }
            result = result + items.get(i);
        }
        return result + "]";
    }
}

class StackException extends Exception {
    public StackException(String message) {
        super(message);
    }
}

class TooFewOperandsException extends RuntimeException {
    public TooFewOperandsException(String message) {
        super(message);
    }
}

class DivideByZeroException extends RuntimeException {
    public DivideByZeroException(String message) {
        super(message);
    }
}
