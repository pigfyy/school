class Animal {} class Dog extends Animal {} class Cat extends Animal {}
class LikeAnimalPair<T extends Animal> { T first, second; LikeAnimalPair(T a, T b){first=a;second=b;} }
