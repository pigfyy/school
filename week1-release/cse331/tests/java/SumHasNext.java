import java.util.ArrayList;
import java.util.List;
import java.util.Scanner;

public class SumHasNext {
  public static void main(String[] args) {
    Scanner in = new Scanner(System.in);
    System.out.println("Enter some numbers.");
    List<Integer> list = new ArrayList<>();
    while (in.hasNext()) {
      list.add(in.nextInt());
    }
    // (1)
    System.out.println("Got " + list);
    int sum = 0;
    for (int i = 0; i < list.size(); i++) {
      sum += list.get(i);
    }
    // (2)
    System.out.println("The sum of your list was: " + sum);
  }
}
