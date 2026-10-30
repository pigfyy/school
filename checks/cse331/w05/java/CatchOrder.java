/** A try whose catch for a superclass comes before a catch for its subclass, as in the notes' broken copy. */
public class CatchOrder {
    public static void main(String[] args) {
        try {
            new ListStack().divide();
        } catch (CalcStack.CalcException e) {
            System.out.println("error: " + e.getMessage());
        } catch (CalcStack.DivideByZeroException e) {
            System.out.println("error: " + e.getMessage());
        }
    }
}
